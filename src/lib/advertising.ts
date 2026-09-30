import { z } from "zod";
import { db, transaction } from "./db";
import { HttpError } from "./auth";
import { safeUrl } from "./security";

const active = `moderation_status='approved' AND starts_at<=now() AND ends_at>now() AND (payment_status='succeeded' OR ($1::boolean AND is_demo AND payment_status='demo'))`;
const demo = () => process.env.APP_ENV === "staging";
export async function activePlacements() {
  return (
    await db().query(
      `SELECT id,advertiser,creative,destination_url,position,logo_url,hero_image_url,description,cta_label,is_demo,ends_at FROM placement_orders WHERE ${active} ORDER BY is_demo ASC,created_at`,
      [demo()],
    )
  ).rows;
}
const exposureSchema = z.object({
  exposureId: z.string().uuid(),
  placementId: z.string().uuid(),
  surface: z.enum(["deck", "browse", "top", "bottom"]),
  category: z.string().max(60).default("All"),
  source: z.string().max(200).default("direct"),
});
export async function adEvent(
  body: unknown,
  deviceHash: string,
  viewable = false,
) {
  const input = exposureSchema.parse(body);
  return transaction(async (c) => {
    const order = (
      await c.query(
        `SELECT position FROM placement_orders WHERE ${active} AND id=$2 FOR SHARE`,
        [demo(), input.placementId],
      )
    ).rows[0];
    if (!order) throw new HttpError(404, "This placement is no longer active.");
    if (!(
      (order.position === "deck" &&
        ["deck", "browse"].includes(input.surface)) ||
      order.position === input.surface ||
      (order.position === "both" && ["top", "bottom"].includes(input.surface))
    ))
      throw new HttpError(400, "Placement surface mismatch.");
    if (!viewable)
      await c.query(
        "INSERT INTO ad_exposures(id,placement_id,device_hash,surface,category,source) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
        [
          input.exposureId,
          input.placementId,
          deviceHash,
          input.surface,
          input.category,
          input.source,
        ],
      );
    const exposure = (
      await c.query(
        "SELECT * FROM ad_exposures WHERE id=$1 AND placement_id=$2 AND device_hash=$3 AND surface=$4 AND category=$5 AND source=$6",
        [
          input.exposureId,
          input.placementId,
          deviceHash,
          input.surface,
          input.category,
          input.source,
        ],
      )
    ).rows[0];
    if (!exposure) throw new HttpError(404, "Exposure not found.");
    if (viewable) {
      const updated = await c.query(
        "UPDATE ad_exposures SET viewable_at=COALESCE(viewable_at,now()) WHERE id=$1 AND created_at<=now()-interval '1 second' RETURNING id",
        [input.exposureId],
      );
      if (!updated.rowCount)
        throw new HttpError(400, "The viewability interval has not elapsed.");
    }
    return { recorded: true };
  });
}
export async function adClick(params: URLSearchParams, deviceHash: string) {
  const input = exposureSchema.parse({
    exposureId: params.get("exposure"),
    placementId: params.get("placement"),
    surface: params.get("surface"),
    category: params.get("category") || "All",
    source: params.get("source") || "direct",
  });
  await adEvent(input, deviceHash);
  const destination = (
    await db().query(
      `SELECT destination_url FROM placement_orders WHERE ${active} AND id=$2`,
      [demo(), input.placementId],
    )
  ).rows[0]?.destination_url;
  if (!destination)
    throw new HttpError(404, "This placement is no longer active.");
  const url = safeUrl(destination);
  await db().query(
    "INSERT INTO ad_clicks(exposure_id) VALUES($1) ON CONFLICT DO NOTHING",
    [input.exposureId],
  );
  url.searchParams.set("utm_source", "backing");
  url.searchParams.set("utm_medium", "sponsored");
  url.searchParams.set("utm_campaign", input.placementId);
  url.searchParams.set("utm_content", input.surface);
  return url.toString();
}
const metrics = `count(*)::int AS served, count(e.viewable_at)::int AS viewable, count(DISTINCT e.device_hash)::int AS audience, count(cl.exposure_id)::int AS outbound_visits, count(DISTINCT e.device_hash) FILTER (WHERE cl.exposure_id IS NOT NULL)::int AS unique_clicks`;
export async function campaignReport(
  id: string,
  userId: string,
  admin: boolean,
) {
  z.string().uuid().parse(id);
  const campaign = (
    await db().query(
      "SELECT id,advertiser,creative,position,description,logo_url,hero_image_url,starts_at,ends_at,amount_usd,payment_status,moderation_status,is_demo FROM placement_orders WHERE id=$1 AND ($3 OR advertiser_id=$2::uuid)",
      [id, admin ? null : userId, admin],
    )
  ).rows[0];
  if (!campaign) throw new HttpError(404, "Campaign not found.");
  const from =
    "FROM ad_exposures e LEFT JOIN ad_clicks cl ON cl.exposure_id=e.id WHERE e.placement_id=$1";
  const stats = (await db().query(`SELECT ${metrics} ${from}`, [id])).rows[0];
  const daily = (
    await db().query(
      `SELECT to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day,${metrics} ${from} GROUP BY day ORDER BY day`,
      [id],
    )
  ).rows;
  const breakdowns: Record<string, unknown[]> = {};
  for (const dimension of ["surface", "category", "source"])
    breakdowns[dimension] = (
      await db().query(
        `SELECT e.${dimension} AS label,${metrics} ${from} GROUP BY e.${dimension} ORDER BY served DESC LIMIT 100`,
        [id],
      )
    ).rows;
  return { campaign, stats, daily, breakdowns };
}
