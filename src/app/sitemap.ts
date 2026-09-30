import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { absoluteUrl, categorySlug, indexable } from "@/lib/seo";
import { categories } from "@/lib/taxonomy";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexable()) return [];
  const companies = (
    await db().query(
      "SELECT slug,category,logo_url,hero_image_url FROM companies WHERE status='approved' AND NOT is_demo ORDER BY slug",
    )
  ).rows;
  const categoryNames = new Set(companies.map((c) => c.category));
  const pages: MetadataRoute.Sitemap = [
    "",
    "/leaderboard",
    "/hall-of-fame",
    "/about",
    "/rules",
    "/advertise",
    "/submit",
    "/companies",
    "/categories",
    ...categories
      .filter((c) => categoryNames.has(c))
      .map((c) => `/categories/${categorySlug(c)}`),
    ...Array.from(
      { length: Math.max(0, Math.ceil(companies.length / 24) - 1) },
      (_, i) => `/companies?page=${i + 2}`,
    ),
  ].map((path) => ({ url: absoluteUrl(path)! }));
  for (const category of categories.filter((c) => categoryNames.has(c))) {
    const total = companies.filter((c) => c.category === category).length;
    for (let page = 2; page <= Math.ceil(total / 24); page++)
      pages.push({
        url: absoluteUrl(`/categories/${categorySlug(category)}?page=${page}`)!,
      });
  }
  return [
    ...pages,
    ...companies.map((c) => ({
      url: absoluteUrl(`/company/${c.slug}`)!,
      images: [c.logo_url, c.hero_image_url]
        .map(absoluteUrl)
        .filter((url): url is string => !!url),
    })),
  ];
}
