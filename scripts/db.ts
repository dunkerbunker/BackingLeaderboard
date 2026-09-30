import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { db, transaction } from "../src/lib/db";
import { categoryDefinitions } from "../src/lib/taxonomy";
import { seedDemoAds } from "./seed-demo-ads";
import { currentSeason } from "../src/lib/leaderboard";

async function migrate() {
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await transaction(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(932101)");
      await c.query(
        "CREATE SCHEMA IF NOT EXISTS backingleaderboard; CREATE TABLE IF NOT EXISTS backingleaderboard.schema_migrations(version text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
      );
      if (
        (
          await c.query("SELECT 1 FROM schema_migrations WHERE version=$1", [
            file,
          ])
        ).rowCount
      )
        return;
      await c.query(readFileSync(`migrations/${file}`, "utf8"));
      await c.query("INSERT INTO schema_migrations(version) VALUES($1)", [
        file,
      ]);
    });
    console.log(`Migration ready: ${file}`);
  }
}
const names = [
  "Orbit",
  "Forma",
  "Raycast",
  "Linear",
  "Tana",
  "Arc",
  "Resend",
  "Framer",
  "Cursor",
  "Notion",
  "Vercel",
  "Loom",
];
async function seed() {
  if (process.env.APP_ENV !== "staging")
    throw new Error("Demo seeding is restricted to staging");
  const season = await currentSeason();
  await transaction(async (c) => {
    for (let i = 0; i < 120; i++) {
      const name =
        i < 12
          ? names[i]
          : `${["Tiny", "Open", "Bright", "Paper", "North", "Good", "Super", "Day", "Craft"][Math.floor((i - 12) / 12)] || "Next"} ${["Studio", "Kit", "Flow", "Notes", "Stack", "Space", "Board", "Labs", "Pages", "Inbox", "Desk", "Cloud"][(i - 12) % 12]}`;
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      const id = randomUUID();
      const [category, , what, audience, tags] =
        categoryDefinitions[i % categoryDefinitions.length];
      const inserted = await c.query(
        `INSERT INTO companies(id,name,slug,url,tagline,description,logo_url,hero_image_url,category,status,is_demo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved',true) ON CONFLICT(slug) DO NOTHING RETURNING id`,
        [
          id,
          name,
          slug,
          `https://example.com/?demo=${slug}`,
          [
            "A little less busywork. A lot more possibility.",
            "The workspace for your next big idea.",
            "Good tools for people who make things.",
            "Make room for your best work.",
            "From first thought to shipped.",
            "Small team. Unreasonably good software.",
          ][i % 6],
          `${name} is a fictional staging listing for testing discovery, backing, and sponsorship.`,
          `/api/demo-asset?kind=logo&name=${encodeURIComponent(name)}&theme=${i % 6}`,
          `/api/demo-asset?kind=hero&name=${encodeURIComponent(name)}&theme=${i % 6}`,
          category,
        ],
      );
      await c.query(
        "UPDATE companies SET category=$2,what_it_does=$3,target_audience=$4,tags=$5,pricing_model=$6,pricing_note=$7 WHERE slug=$1 AND is_demo",
        [
          slug,
          category,
          what,
          audience,
          tags,
          ["free", "freemium", "paid", "freemium", "contact", "free"][i % 6],
          "Illustrative staging pricing; this is a fictional listing.",
        ],
      );
      if (inserted.rowCount) {
        await c.query(
          "INSERT INTO company_season_stats(company_id,season_id) VALUES($1,$2)",
          [id, season.id],
        );
        // Every demo point has a traceable ledger entry; no invented real payments.
        const points = Math.max(2, 150 - i);
        await c.query(
          `INSERT INTO community_backs(id,company_id,season_id,device_hash,ip_hash,risk_score,valid) SELECT gen_random_uuid(),$1,$2,'demo-'||$3||'-'||n,'demo',0,true FROM generate_series(1,$4::integer) n`,
          [id, season.id, slug, points],
        );
        await c.query(
          "UPDATE company_season_stats SET community_points=$3 WHERE company_id=$1 AND season_id=$2",
          [id, season.id, points],
        );
      }
    }
    await seedDemoAds(c);
    const demoCompanies = (
      await c.query(
        "SELECT id,slug FROM companies WHERE is_demo=true AND status='approved' ORDER BY created_at LIMIT 12",
      )
    ).rows;
    for (const weeksAgo of [1, 2]) {
      const start = new Date(
        new Date(season.starts_at).getTime() - weeksAgo * 7 * 86400000,
      );
      const end = new Date(start.getTime() + 7 * 86400000);
      const old = (
        await c.query(
          "INSERT INTO seasons(id,starts_at,ends_at,status) VALUES($1,$2,$3,'archived') ON CONFLICT(starts_at) DO UPDATE SET status='archived' RETURNING id",
          [randomUUID(), start, end],
        )
      ).rows[0];
      for (let i = 0; i < demoCompanies.length; i++) {
        const company = demoCompanies[(i + weeksAgo) % demoCompanies.length];
        const points = 240 - i * 13;
        const inserted = await c.query(
          "INSERT INTO company_season_stats(company_id,season_id,community_points,reached_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING company_id",
          [company.id, old.id, points, new Date(end.getTime() - 3600000)],
        );
        if (inserted.rowCount)
          await c.query(
            "INSERT INTO community_backs(id,company_id,season_id,device_hash,ip_hash,risk_score,valid,created_at) SELECT gen_random_uuid(),$1,$2,'demo-history-'||$3||'-'||n,'demo',0,true,$5 FROM generate_series(1,$4::integer) n",
            [
              company.id,
              old.id,
              company.slug,
              points,
              new Date(end.getTime() - 3600000),
            ],
          );
      }
    }
  });
  console.log(
    "Staging seed ready: 120 demo companies across 30 categories, 3 unpaid demo ads and two historical seasons.",
  );
}
async function main() {
  try {
    if (process.argv[2] === "migrate") await migrate();
    else if (process.argv[2] === "seed") await seed();
    else if (process.argv[2] === "check") {
      const r = await db().query(
        "SELECT current_database() AS database, current_schema() AS schema",
      );
      console.log(r.rows[0]);
    } else throw new Error("Use migrate, seed, or check");
  } finally {
    await db().end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
