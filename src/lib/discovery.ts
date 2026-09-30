import { db } from "./db";
import { z } from "zod";
import { normalizeCategory } from "./taxonomy";
import { categories, pricingModels } from "./validation";

export const catalogColumns =
  "id,name,slug,url,tagline,description,category,logo_url,hero_image_url,verification_status,is_demo,what_it_does,target_audience,pricing_model,pricing_note,tags";
export async function catalog(params: URLSearchParams) {
  const search = z
    .string()
    .max(100)
    .parse(params.get("q") || "")
    .trim();
  const category = normalizeCategory(params.get("category") || "");
  const pricing = params.get("pricing") || "";
  if (category) z.enum(categories).parse(category);
  if (pricing) z.enum(pricingModels).parse(pricing);
  const tag = z
    .string()
    .max(30)
    .parse(params.get("tag") || "");
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .parse(params.get("page") || 1);
  const ids = params.has("ids")
    ? z
        .array(z.string().uuid())
        .max(100)
        .parse((params.get("ids") || "").split(",").filter(Boolean))
    : null;
  // LIKE wildcards are escaped: a search for '%' should not match every company.
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  const values = [pattern, category || null, pricing || null, tag || null, ids];
  const where = `status='approved' AND ($1='%%' OR concat_ws(' ',name,tagline,what_it_does,target_audience,array_to_string(tags,' ')) ILIKE $1) AND ($2::text IS NULL OR category=$2) AND ($3::text IS NULL OR pricing_model=$3) AND ($4::text IS NULL OR $4=ANY(tags)) AND ($5::uuid[] IS NULL OR id=ANY($5))`;
  const result = await db().query(
    `SELECT ${catalogColumns} FROM companies WHERE ${where} ORDER BY CASE WHEN $5::uuid[] IS NOT NULL THEN array_position($5::uuid[],id) END,name,id LIMIT $6 OFFSET $7`,
    [...values, ids ? 100 : 24, ids ? 0 : (page - 1) * 24],
  );
  const total = (
    await db().query(
      `SELECT count(*)::int AS total FROM companies WHERE ${where}`,
      values,
    )
  ).rows[0].total;
  const tags = (
    await db().query(
      "SELECT DISTINCT unnest(tags) AS tag FROM companies WHERE status='approved' ORDER BY tag LIMIT 100",
    )
  ).rows.map((row) => row.tag as string);
  return { companies: result.rows, total, page, tags };
}
