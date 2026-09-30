import Link from "next/link";
import { directory, directoryCategories } from "@/lib/public-directory";
import { categorySlug, absoluteUrl } from "@/lib/seo";
import { pricingLabels } from "@/lib/validation";
import { tagLabel } from "@/lib/taxonomy";
import { StructuredData } from "./structured-data";

export function DiscoveryGuide() {
  return (
    <section className="discovery-guide" aria-label="About company discovery">
      <div>
        <span className="eyebrow">GOOD COMPANIES DESERVE TO BE FOUND</span>
        <h2>A little curiosity. A useful discovery.</h2>
        <p>
          Explore companies by what they do, who they help, and whether they
          offer free or paid plans. Save a shortlist in your browser, or give a
          company a Back without signing up.
        </p>
      </div>
      <nav aria-label="Explore Backing">
        <Link href="/companies">Explore all companies →</Link>
        <Link href="/categories">Browse 30 categories →</Link>
        <Link href="/leaderboard">This week’s leaderboard →</Link>
        <Link href="/rules">How backing works →</Link>
      </nav>
      <p className="guide-note">
        One valid community Back adds one point. One confirmed US dollar of
        sponsorship adds one sponsored point. Both are shown separately; a
        ranking is visibility, not a quality certification. Clearly labeled
        advertisements add no points.
      </p>
    </section>
  );
}
export async function CategoryDirectory() {
  const categories = await directoryCategories();
  return (
    <div className="page-container directory-page">
      <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
      <h1>Find your kind of company.</h1>
      <p className="directory-intro">
        Explore 30 categories, from developer tools to health and wellness. Each
        listing explains what it does, who it helps, and its pricing model.
      </p>
      <div className="category-directory">
        {categories.map((c) => (
          <Link key={c.slug} href={`/categories/${c.slug}`}>
            <h2>{c.name}</h2>
            <span>
              {c.count} {c.count === 1 ? "company" : "companies"} →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
export async function CompanyDirectory({
  category = "",
  page = 1,
}: {
  category?: string;
  page?: number;
}) {
  const data = await directory(category, page);
  const path = category
    ? `/categories/${categorySlug(category)}`
    : "/companies";
  const canonical = `${path}${page > 1 ? `?page=${page}` : ""}`;
  const origin = absoluteUrl("/");
  return (
    <div className="page-container directory-page">
      <nav className="directory-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Discover</Link>
        <span>/</span>
        <Link href="/categories">Categories</Link>
        <span>/</span>
        <span>{category || "All companies"}</span>
      </nav>
      <span className="eyebrow">USEFUL IDEAS, OPEN TO EVERYONE</span>
      <h1>{category || "Explore all companies."}</h1>
      <p className="directory-intro">
        {category
          ? `Discover companies in ${category.toLowerCase()}.`
          : "Find your next favorite company."}{" "}
        Compare what they do, who they help, and free or paid pricing before
        opening a profile. Community and sponsored backing are shown separately
        on the leaderboard.
      </p>
      <div className="directory-summary">
        <span>
          {data.total} {data.total === 1 ? "company" : "companies"}
          {page > 1 ? ` · Page ${page}` : ""}
        </span>
        <Link href="/categories">All categories →</Link>
      </div>
      <div className="public-company-grid">
        {data.companies.map((c) => (
          <article key={c.id}>
            <Link className="directory-image" href={`/company/${c.slug}`}>
              <img
                src={c.hero_image_url}
                alt={`${c.name} ${c.is_demo ? "fictional demo preview" : "product screenshot"}`}
                width={1000}
                height={600}
                loading="lazy"
              />
            </Link>
            <div className="directory-card-body">
              <div className="directory-identity">
                <img
                  src={c.logo_url}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                />
                <h2>
                  <Link href={`/company/${c.slug}`}>{c.name}</Link>
                </h2>
              </div>
              <Link
                className="directory-category"
                href={`/categories/${categorySlug(c.category)}`}
              >
                {c.category}
              </Link>
              <p>{c.what_it_does || c.tagline}</p>
              {c.target_audience && (
                <p className="directory-audience">
                  <strong>For:</strong> {c.target_audience}
                </p>
              )}
              <div className="directory-tags">
                <span>
                  {pricingLabels[c.pricing_model] || pricingLabels.unknown}
                </span>
                {c.tags.slice(0, 3).map((tag) => (
                  <span key={tag}>{tagLabel(tag)}</span>
                ))}
              </div>
              {c.is_demo && <small>Fictional staging company</small>}
            </div>
          </article>
        ))}
      </div>
      {!data.total && (
        <p className="directory-empty">
          There are no approved companies here yet.{" "}
          <Link href="/submit">Submit a company</Link> to help people find
          something useful.
        </p>
      )}
      {data.total > 24 && (
        <nav className="directory-pagination" aria-label="Directory pages">
          {page > 1 && (
            <Link href={`${path}${page > 2 ? `?page=${page - 1}` : ""}`}>
              ← Previous
            </Link>
          )}
          <span>
            Page {page} of {Math.ceil(data.total / 24)}
          </span>
          {page * 24 < data.total && (
            <Link href={`${path}?page=${page + 1}`}>Next →</Link>
          )}
        </nav>
      )}
      {origin && (
        <StructuredData
          data={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: category || "Company directory",
            url: absoluteUrl(canonical),
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: data.companies.length,
              itemListElement: data.companies.map((c, i) => ({
                "@type": "ListItem",
                position: (page - 1) * 24 + i + 1,
                item: {
                  "@type": "Organization",
                  name: c.name,
                  url: absoluteUrl(`/company/${c.slug}`),
                  description: c.what_it_does || c.tagline,
                },
              })),
            },
          }}
        />
      )}
    </div>
  );
}
