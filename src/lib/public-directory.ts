import { db } from "./db";
import { cache } from "react";
import { catalogColumns } from "./discovery";
import type { Company } from "./leaderboard";
import { categories } from "./taxonomy";
import { categorySlug } from "./seo";

export const directory = cache(async (category = "", page = 1) => {
  const where =
    "status='approved' AND ($1::text IS NULL OR category=$1) AND ($2::boolean OR NOT is_demo)";
  const values = [category || null, process.env.APP_ENV === "staging"];
  const [list, count] = await Promise.all([
    db().query(
      `SELECT ${catalogColumns} FROM companies WHERE ${where} ORDER BY name,id LIMIT 24 OFFSET $3`,
      [...values, (page - 1) * 24],
    ),
    db().query(
      `SELECT count(*)::int AS total FROM companies WHERE ${where}`,
      values,
    ),
  ]);
  return {
    companies: list.rows as Company[],
    total: count.rows[0].total as number,
    page,
  };
});
export const directoryCategories = cache(async () => {
  const result = await db().query(
    "SELECT category,count(*)::int AS count FROM companies WHERE status='approved' AND ($1::boolean OR NOT is_demo) GROUP BY category",
    [process.env.APP_ENV === "staging"],
  );
  const counts = new Map<string, number>(
    result.rows.map((row) => [row.category, row.count]),
  );
  return categories.map((name) => ({
    name,
    slug: categorySlug(name),
    count: counts.get(name) || 0,
  }));
});
