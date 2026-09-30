import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { App } from "@/components/app";
import { companyBySlug, leaderboard } from "@/lib/leaderboard";
import { cache } from "react";
import { db } from "@/lib/db";
import {
  pageMetadata,
  absoluteUrl,
  siteDescription,
  categorySlug,
} from "@/lib/seo";
import { categories, categoryLabel } from "@/lib/taxonomy";
import { directory } from "@/lib/public-directory";
import { StructuredData } from "@/components/structured-data";
import {
  CompanyDirectory,
  CategoryDirectory,
  DiscoveryGuide,
} from "@/components/public-directory";
const getCompany = cache(companyBySlug);
const getBoard = cache(leaderboard);
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ view?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const pages: Record<string, [string, string]> = {
  "": ["Discover useful companies", siteDescription],
  leaderboard: [
    "Weekly company leaderboard",
    "See this week’s company rankings. Every score shows community support and confirmed sponsored backing separately, with a fresh season every Monday.",
  ],
  "hall-of-fame": [
    "Hall of Fame — weekly company champions",
    "Explore past weekly champions on Backing and the community and sponsored backing behind each winning score.",
  ],
  companies: [
    "Company directory — find your next favorite",
    "Browse approved companies with descriptions, audiences, pricing models and useful tags. Find free tools, paid products and ideas worth backing.",
  ],
  categories: [
    "Explore 30 company categories",
    "Find companies in AI, developer tools, marketing, design and 26 more categories. Compare what they do, who they help and how they are priced.",
  ],
  about: [
    "About Backing — how company discovery works",
    "Backing helps good companies get found through a fair discovery feed and a transparent weekly leaderboard of community support and sponsorship.",
  ],
  rules: [
    "Backing rules — scoring, sponsorship and privacy",
    "Understand community backs, sponsored points, weekly resets, fair discovery, advertising disclosures, fraud prevention and visitor privacy.",
  ],
  advertise: [
    "Advertise on Backing",
    "Reach curious visitors with clearly labeled sponsor cards and banner placements. Track viewable impressions, browser reach, unique clicks and tagged outbound visits.",
  ],
  submit: [
    "Submit your company",
    "Add your company to Backing with a clear description, real screenshots, audience and pricing information. Listings are reviewed before publication.",
  ],
  dashboard: [
    "Founder dashboard",
    "Manage your companies, ownership verification and private company analytics.",
  ],
  campaigns: [
    "Advertiser campaign reports",
    "Access your private campaign performance and placement reporting.",
  ],
  admin: [
    "Administration",
    "Private moderation and administration for Backing.",
  ],
  claim: ["Claim your company", "Verify ownership of your company on Backing."],
  sponsor: [
    "Sponsor a company",
    "Give a company transparent sponsored backing through a confirmed payment.",
  ],
};
function directoryPage(value: string | string[] | undefined) {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d{0,3}$/.test(value)) notFound();
  return Number(value);
}
function categoryFor(view: string[]) {
  return categories.find((c) => categorySlug(c) === view[1]);
}
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { view = [] } = await params;
  const root = view[0] || "";
  const path = `/${view.join("/")}`;
  if (root === "company" && view.length === 2) {
    const company = await getCompany(view[1]);
    if (!company)
      return pageMetadata(
        "Company not found",
        "This company is not available.",
        path,
        { noindex: true },
      );
    return pageMetadata(
      `${company.name} — ${categoryLabel(company.category)}`,
      (company.what_it_does || company.description || company.tagline).slice(
        0,
        180,
      ),
      path,
      { noindex: company.is_demo, image: `/api/share/${company.slug}` },
    );
  }
  if (root === "companies" || (root === "categories" && view.length === 2)) {
    const category = root === "categories" ? categoryFor(view) : "";
    if (category === undefined) notFound();
    const page = directoryPage((await searchParams).page);
    const data = await directory(category, page);
    const title = category ? `${category} companies` : pages.companies[0];
    return pageMetadata(
      `${title}${page > 1 ? ` — page ${page}` : ""}`,
      category
        ? `Explore ${category.toLowerCase()} companies. Compare their purpose, audience, pricing and useful tags, then support your favorites on Backing.`
        : pages.companies[1],
      `${path}${page > 1 ? `?page=${page}` : ""}`,
      { noindex: !data.total },
    );
  }
  const [title, description] = pages[root] || [
    "Page not found",
    "This page is not available.",
  ];
  return pageMetadata(title, description, path, {
    image: ["leaderboard", "companies", "categories", "hall-of-fame"].includes(
      root,
    )
      ? `/social/${root}.png`
      : undefined,
    noindex:
      ["admin", "dashboard", "campaigns", "claim", "sponsor"].includes(root) ||
      !Object.hasOwn(pages, root),
  });
}
// PostgreSQL timestamps cross the server/client boundary as stable strings.
function serializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
export default async function Page({ params, searchParams }: Props) {
  const { view = [] } = await params;
  const root = view[0] || "";
  if (root !== "company" && !Object.hasOwn(pages, root)) notFound();
  let company: Awaited<ReturnType<typeof companyBySlug>> = null;
  if (["company", "claim", "sponsor"].includes(root)) {
    if (view.length !== 2 || !(company = await getCompany(view[1]))) notFound();
  } else if (root === "categories") {
    if (view.length > 2 || (view.length === 2 && !categoryFor(view)))
      notFound();
  } else if (view.length > 1) notFound();
  const path = `/${view.join("/")}`;
  let content;
  if (!root) content = <DiscoveryGuide />;
  if (root === "categories" && view.length === 1)
    content = <CategoryDirectory />;
  if (root === "companies" || (root === "categories" && view.length === 2)) {
    const category = root === "categories" ? categoryFor(view)! : "";
    const page = directoryPage((await searchParams).page);
    const data = await directory(category, page);
    if (page > 1 && (page - 1) * 24 >= data.total) notFound();
    content = <CompanyDirectory category={category} page={page} />;
  }
  const board = root === "leaderboard" ? await getBoard() : undefined;
  const winners =
    root === "hall-of-fame"
      ? await Promise.all(
          (
            await db().query(
              "SELECT id FROM seasons WHERE status='archived' ORDER BY starts_at DESC LIMIT 52",
            )
          ).rows.map((s) => leaderboard(s.id)),
        )
      : undefined;
  const url = absoluteUrl(path);
  const schema: Record<string, unknown>[] = [];
  if (
    url &&
    !["admin", "dashboard", "campaigns", "claim", "sponsor"].includes(root)
  ) {
    schema.push({
      "@type": "WebPage",
      "@id": `${url}#page`,
      url,
      name: company?.name || pages[root]?.[0] || categoryFor(view),
      description: company?.what_it_does || pages[root]?.[1],
      isPartOf: { "@id": `${absoluteUrl("/")}#website` },
    });
    if (!root)
      schema.push({
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: "Backing",
        url,
        description: siteDescription,
        publisher: {
          "@type": "Organization",
          name: "Backing",
          url,
          logo: absoluteUrl("/icon.svg"),
        },
      });
    if (root)
      schema.push({
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Backing",
            item: absoluteUrl("/"),
          },
          ...(view.length > 1
            ? [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: root === "company" ? "Companies" : "Categories",
                  item: absoluteUrl(
                    root === "company" ? "/companies" : "/categories",
                  ),
                },
              ]
            : []),
          {
            "@type": "ListItem",
            position: view.length > 1 ? 3 : 2,
            name: company?.name || categoryFor(view) || pages[root]?.[0],
            item: url,
          },
        ],
      });
    if (root === "company" && company)
      schema.push({
        "@type": "Organization",
        "@id": `${url}#company`,
        name: company.name,
        url: company.url,
        description:
          company.what_it_does || company.description || company.tagline,
        logo: absoluteUrl(company.logo_url),
        image: absoluteUrl(company.hero_image_url),
        subjectOf: { "@id": `${url}#page` },
        keywords: company.tags.join(", "),
      });
    if (board)
      schema.push({
        "@type": "ItemList",
        name: "Weekly company leaderboard",
        description:
          "Ranked by community points plus sponsored points; ranking is not a quality certification.",
        itemListElement: board.companies.map((c) => ({
          "@type": "ListItem",
          position: c.rank,
          name: c.name,
          url: absoluteUrl(`/company/${c.slug}`),
        })),
      });
  }
  return (
    <>
      {schema.length > 0 && (
        <StructuredData
          data={{ "@context": "https://schema.org", "@graph": schema }}
        />
      )}
      <App
        view={view}
        content={content}
        initialBoard={board && serializable(board)}
        initialCompany={
          root === "company" && company ? serializable(company) : undefined
        }
        initialWinners={winners && serializable(winners)}
        shareUrl={company ? absoluteUrl(`/company/${company.slug}`) : undefined}
      />
    </>
  );
}
