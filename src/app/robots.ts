import type { MetadataRoute } from "next";
import { absoluteUrl, indexable } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  if (!indexable()) return { rules: { userAgent: "*", disallow: "/" } };
  const rule = {
    allow: ["/", "/api/uploads/", "/api/share/"],
    disallow: [
      "/api/",
      "/admin",
      "/dashboard",
      "/campaigns",
      "/claim/",
      "/sponsor/",
    ],
  };
  return {
    rules: [
      { userAgent: "*", ...rule },
      {
        userAgent: ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot"],
        ...rule,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
