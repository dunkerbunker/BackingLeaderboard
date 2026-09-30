import sharp from "sharp";
import { createHash } from "node:crypto";
import { db } from "../src/lib/db";

async function main() {
  if (process.env.APP_ENV !== "staging")
    throw new Error("Demo image uploads are restricted to staging.");
  const configuredOrigin = process.env.APP_URL;
  if (!configuredOrigin)
    throw new Error("Set staging APP_URL to the running server URL.");
  const origin = new URL(configuredOrigin).origin;
  const files = new Map<string, string>();
  const health = await fetch(`${origin}/api/health`);
  if (!health.ok || (await health.json()).environment !== "staging")
    throw new Error("The target must be the staging server.");
  const login = await fetch(`${origin}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
  });
  if (!login.ok)
    throw new Error(`Staging authentication failed (${login.status}).`);
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Authentication did not return a session.");
  let uploaded = 0;
  async function asset(source: string): Promise<string> {
    if (!source.startsWith("/api/demo-asset?")) {
      const response = await fetch(new URL(source, origin), { method: "HEAD" });
      if (!response.ok)
        throw new Error(
          `A stored staging image is unavailable (${response.status}).`,
        );
      return source;
    }
    const response = await fetch(new URL(source, origin));
    if (!response.ok) throw new Error("Could not load staging artwork.");
    const png = await sharp(Buffer.from(await response.arrayBuffer()))
      .png()
      .toBuffer();
    const hash = createHash("sha256").update(png).digest("hex");
    const existing = files.get(hash);
    if (existing) return existing;
    const form = new FormData();
    form.set(
      "file",
      new Blob([new Uint8Array(png)], { type: "image/png" }),
      "staging-artwork.png",
    );
    // Respect the endpoint's per-account upload rate limit.
    await new Promise((resolve) => setTimeout(resolve, 4500));
    const result = await fetch(`${origin}/api/upload`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: origin },
      body: form,
    });
    if (!result.ok) throw new Error(`Image upload failed (${result.status}).`);
    const { url } = await result.json();
    const saved = await fetch(new URL(url, origin));
    if (!saved.ok || !saved.headers.get("content-type")?.startsWith("image/"))
      throw new Error("Uploaded image could not be served.");
    await sharp(Buffer.from(await saved.arrayBuffer())).metadata();
    uploaded++;
    files.set(hash, url);
    return url;
  }
  // Only fictional fixtures can be changed; preserve all real company creatives.
  for (const company of (
    await db().query(
      "SELECT id,logo_url,hero_image_url FROM companies WHERE is_demo AND status='approved' ORDER BY name",
    )
  ).rows) {
    const logo = await asset(company.logo_url);
    const hero = await asset(company.hero_image_url);
    await db().query(
      "UPDATE companies SET logo_url=$2,hero_image_url=$3 WHERE id=$1 AND is_demo",
      [company.id, logo, hero],
    );
    if (uploaded && uploaded % 20 === 0)
      console.log(`${uploaded} staging images uploaded and verified.`);
  }
  for (const ad of (
    await db().query(
      "SELECT id,logo_url,hero_image_url FROM placement_orders WHERE is_demo AND payment_status='demo'",
    )
  ).rows) {
    const logo = await asset(ad.logo_url);
    const hero = await asset(ad.hero_image_url);
    await db().query(
      "UPDATE placement_orders SET logo_url=$2,hero_image_url=$3 WHERE id=$1 AND is_demo AND payment_status='demo'",
      [ad.id, logo, hero],
    );
  }
  console.log(
    `Staging asset upload complete: ${uploaded} new files; all referenced images verified.`,
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db().end());
