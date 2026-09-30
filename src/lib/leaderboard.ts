import { randomUUID } from "node:crypto";
import { db, transaction } from "./db";
import type { PoolClient } from "pg";

export type Season = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};
export type Company = {
  id: string;
  name: string;
  slug: string;
  url: string;
  tagline: string;
  description: string;
  category: string;
  what_it_does: string;
  target_audience: string;
  pricing_model: string;
  pricing_note: string;
  tags: string[];
  logo_url: string;
  hero_image_url: string;
  verification_status: string;
  is_demo: boolean;
  rank: number;
  previous_rank: number | null;
  community_points: number;
  sponsored_points: number;
  total_points: number;
  impressions: number;
  skips: number;
  clicks: number;
  profile_views: number;
  feed_backs: number;
};
export function weekBounds(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return {
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 7 * 86400000).toISOString(),
  };
}
export async function currentSeason(): Promise<Season> {
  const bounds = weekBounds();
  const existing = (
    await db().query("SELECT * FROM seasons WHERE starts_at=$1", [
      bounds.starts_at,
    ])
  ).rows[0];
  if (existing) return existing;
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(932102)");
    await c.query(
      "UPDATE seasons SET status='archived' WHERE ends_at<=now() AND status='active'",
    );
    const season = (
      await c.query(
        `INSERT INTO seasons(id,starts_at,ends_at) VALUES($1,$2,$3) ON CONFLICT(starts_at) DO UPDATE SET starts_at=EXCLUDED.starts_at RETURNING *`,
        [randomUUID(), bounds.starts_at, bounds.ends_at],
      )
    ).rows[0];
    await c.query(
      `INSERT INTO company_season_stats(company_id,season_id) SELECT id,$1 FROM companies WHERE status='approved' ON CONFLICT DO NOTHING`,
      [season.id],
    );
    return season;
  });
}
export const rankedSql = `SELECT c.*, s.community_points,s.sponsored_points,s.total_points,s.previous_rank,s.impressions,s.skips,s.clicks,s.profile_views,s.feed_backs,
 (row_number() OVER(ORDER BY s.total_points DESC,s.reached_at ASC,c.created_at ASC,c.id ASC))::integer AS rank
 FROM companies c JOIN company_season_stats s ON c.id=s.company_id WHERE s.season_id=$1 AND c.status='approved'`;
export async function leaderboard(seasonId?: string) {
  const season = seasonId
    ? (await db().query("SELECT * FROM seasons WHERE id=$1", [seasonId]))
        .rows[0]
    : await currentSeason();
  if (!season) throw new Error("Season not found");
  const companies = (
    await db().query(`${rankedSql} ORDER BY rank`, [season.id])
  ).rows as Company[];
  return {
    season,
    companies,
    totals: {
      community: companies.reduce((n, c) => n + c.community_points, 0),
      sponsored: companies.reduce((n, c) => n + c.sponsored_points, 0),
    },
  };
}
export async function companyBySlug(slug: string) {
  const board = await leaderboard();
  const company = board.companies.find((c) => c.slug === slug);
  if (!company) return null;
  const ahead = board.companies.find((c) => c.rank === company.rank - 1);
  return {
    ...company,
    season: board.season,
    gap: ahead ? ahead.total_points - company.total_points + 1 : 0,
  };
}
export async function recordEvent(
  c: PoolClient,
  companyId: string,
  seasonId: string,
  kind: string,
  device: string,
  source = "direct",
) {
  await c.query(
    "INSERT INTO analytics_events(company_id,season_id,kind,device_hash,source) VALUES($1,$2,$3,$4,$5)",
    [companyId, seasonId, kind, device, source.slice(0, 200)],
  );
}
export async function snapshot() {
  const season = await currentSeason();
  await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(932104)");
    const due = (
      await c.query(
        "SELECT 1 FROM seasons WHERE id=$1 AND (snapshot_at IS NULL OR snapshot_at<now()-interval '15 minutes')",
        [season.id],
      )
    ).rowCount;
    if (!due) return;
    await c.query(
      `UPDATE company_season_stats s SET previous_rank=r.rank FROM (${rankedSql}) r WHERE s.company_id=r.id AND s.season_id=$1`,
      [season.id],
    );
    await c.query("UPDATE seasons SET snapshot_at=now() WHERE id=$1", [
      season.id,
    ]);
  });
}
