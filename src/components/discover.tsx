"use client";
import { CategoryFilter } from "./category-filter";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Clock3,
  Compass,
  Grid2X2,
  Search,
  ArrowRight,
} from "lucide-react";
import { SwipeDiscover } from "./swipe-discovery";
import { useLibrary, SaveButton } from "./library";
import { Advertisement, usePlacements } from "./advertisement";
import { api, Alert, Empty, Logo, Spinner, Visit } from "./ui";
import { tagLabel } from "@/lib/taxonomy";
import { pricingLabels } from "@/lib/validation";
import type { Company } from "@/lib/leaderboard";
export { Challenge } from "./challenge";
export function Discover() {
  const library = useLibrary();
  return (
    <>
      <div className="discovery-navigation">
        <div
          className="discovery-modes"
          role="group"
          aria-label="Discovery mode"
        >
          {(
            [
              ["swipe", "Swipe", Compass],
              ["browse", "Browse", Grid2X2],
              ["saved", "Saved", Bookmark],
              ["recent", "Recent", Clock3],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              aria-pressed={library.mode === id}
              onClick={() => library.setMode(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
              {id === "saved" && library.saved.length > 0 && (
                <small>{library.saved.length}</small>
              )}
            </button>
          ))}
        </div>
        <span className="library-hint">Your curiosity, your way.</span>
      </div>
      {library.storageError && (
        <Alert>
          Browser storage is unavailable. Your shortlist will last for this
          session only.
        </Alert>
      )}
      {!library.ready ? (
        <div className="loading">
          <Spinner />
        </div>
      ) : library.mode === "swipe" ? (
        <SwipeDiscover />
      ) : (
        <Catalog key={library.mode} mode={library.mode} />
      )}
    </>
  );
}
type CatalogData = { companies: Company[]; total: number; tags: string[] };
function Catalog({ mode }: { mode: "browse" | "saved" | "recent" }) {
  const { saved, recent, clear, setMode } = useLibrary();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [pricing, setPricing] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogData>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const placements = usePlacements();
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [mode]);
  const ids = mode === "saved" ? saved : recent;
  const collection = mode === "browse" ? "" : ids.join(",");
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    const params = new URLSearchParams({
      q: query,
      category,
      pricing,
      tag,
      page: String(page),
    });
    if (mode !== "browse") params.set("ids", collection);
    void api<CatalogData>(`catalog?${params}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, category, pricing, tag, page, mode, collection, retry]);

  const sponsor = placements.find((p) => p.position === "deck");
  return (
    <div className="catalog-world">
      <div className="catalog-heading">
        <div>
          <span className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</span>
          <h1>
            {mode === "browse"
              ? "Find your next favorite."
              : mode === "saved"
                ? "Good finds, kept close."
                : "Where curiosity took you."}
          </h1>
          <p>
            {mode === "browse"
              ? "Find something useful. Explore by what it does, who it helps, or what it costs."
              : mode === "saved"
                ? "Your private shortlist. Saving adds no points. No account needed."
                : "The last 50 companies you opened or saw in Swipe."}
          </p>
        </div>
        {mode !== "browse" && ids.length > 0 && (
          <button
            className="text-button"
            onClick={() => clear(mode === "saved" ? "saved" : "recent")}
          >
            Clear {mode === "saved" ? "saved companies" : "history"}
          </button>
        )}
      </div>
      <div className="catalog-tools">
        <label className="catalog-search">
          <Search size={19} />
          <input
            aria-label="Search companies"
            placeholder="Search names, ideas, audiences…"
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter pricing"
          value={pricing}
          onChange={(e) => {
            setPricing(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any pricing</option>
          {Object.entries(pricingLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter tags"
          value={tag}
          onChange={(e) => {
            setTag(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any tag</option>
          {data?.tags.map((t) => (
            <option key={t} value={t}>
              {tagLabel(t)}
            </option>
          ))}
        </select>
      </div>
      <CategoryFilter
        value={category}
        allValue=""
        onChange={(value) => {
          setCategory(value);
          setPage(1);
        }}
        variant="catalog-category-filter"
      />
      <div className="catalog-results">
        <span>
          {busy ? "Finding good things…" : `${data?.total || 0} companies`}
        </span>
        {mode !== "browse" && (
          <span>Stored on this browser · Approved listings only</span>
        )}
      </div>
      {error && (
        <Alert>
          {error}{" "}
          <button
            className="text-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry
          </button>
        </Alert>
      )}
      <div className="catalog-grid" aria-busy={busy}>
        {data?.companies.map((company, index) => (
          <div className="catalog-slot" key={company.id}>
            <article className="catalog-card">
              <Link
                href={`/company/${company.slug}`}
                className="catalog-preview"
              >
                <img
                  src={company.hero_image_url}
                  alt={`${company.name} product preview`}
                  loading="lazy"
                />
                {company.is_demo && (
                  <span className="demo-label">Staging demo</span>
                )}
              </Link>
              <div className="catalog-card-body">
                <div className="catalog-identity">
                  <Logo src={company.logo_url} name={company.name} size={40} />
                  <div>
                    <Link href={`/company/${company.slug}`}>
                      <h2>{company.name}</h2>
                    </Link>
                    <span>{company.category}</span>
                  </div>
                  <SaveButton company={company} compact />
                </div>
                <p>{company.what_it_does || company.tagline}</p>
                {company.target_audience && (
                  <p className="catalog-audience">
                    For {company.target_audience}
                  </p>
                )}
                <div className="useful-tags">
                  {company.tags.slice(0, 3).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTag(t);
                        setPage(1);
                      }}
                    >
                      {tagLabel(t)}
                    </button>
                  ))}
                </div>
                <div className="catalog-card-footer">
                  <span>{pricingLabels[company.pricing_model]}</span>
                  <Visit company={company} />
                </div>
              </div>
            </article>
            {sponsor && mode === "browse" && index === 5 && (
              <Advertisement
                key={`${sponsor.id}:${page}`}
                placement={sponsor}
                surface="browse"
                category={category || "All"}
              />
            )}
          </div>
        ))}
      </div>
      {!busy && !error && data?.companies.length === 0 && (
        <Empty
          title={
            mode === "saved" && !saved.length
              ? "Save a little inspiration."
              : "No companies found."
          }
        >
          {mode === "saved" && !saved.length
            ? "Tap the bookmark on any company to keep it here."
            : mode === "recent" && !recent.length
              ? "Open a profile or explore the swipe deck to start your history."
              : "Try another search or filter. Removed listings won’t appear here."}
          <button
            className="text-button"
            onClick={() => {
              setSearch("");
              setCategory("");
              setPricing("");
              setTag("");
              setMode("browse");
            }}
          >
            Explore companies <ArrowRight size={16} />
          </button>
        </Empty>
      )}
      {mode === "browse" && (data?.total || 0) > 24 && (
        <div className="catalog-pagination">
          <button
            className="button"
            disabled={page === 1 || busy}
            onClick={() => {
              setPage((n) => n - 1);
              window.scrollTo({ top: 0 });
            }}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil((data?.total || 0) / 24)}
          </span>
          <button
            className="button"
            disabled={page * 24 >= (data?.total || 0) || busy}
            onClick={() => {
              setPage((n) => n + 1);
              window.scrollTo({ top: 0 });
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
