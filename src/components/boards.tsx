"use client";
import { CategoryFilter } from "./category-filter";
import { SaveButton, CompanyFacts, useLibrary } from "./library";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  Flag,
  Minus,
  Plus,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import {
  Alert,
  api,
  ApiError,
  Countdown,
  Empty,
  Logo,
  money,
  PageHeading,
  Share,
  Spinner,
  trafficSource,
  Visit,
} from "./ui";
import { Challenge } from "./discover";
import type { Company, Season } from "@/lib/leaderboard";

export function Movement({ company }: { company: Company }) {
  const delta = company.previous_rank
    ? company.previous_rank - company.rank
    : 0;
  return (
    <span
      className={`movement ${delta > 0 ? "up" : delta < 0 ? "down" : ""}`}
      role="img"
      aria-label={
        delta
          ? `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} places`
          : "No movement"
      }
    >
      {delta > 0 ? (
        <ArrowUp size={13} />
      ) : delta < 0 ? (
        <ArrowDown size={13} />
      ) : (
        <Minus size={13} />
      )}{" "}
      {delta ? Math.abs(delta) : ""}
    </span>
  );
}
export function Board({
  initial,
}: {
  initial?: { companies: Company[]; season: Season };
}) {
  const [companies, setCompanies] = useState<Company[]>(
    initial?.companies || [],
  );
  const [season, setSeason] = useState<Season | undefined>(initial?.season);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selected, setSelected] = useState("");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!initial);
  useEffect(() => {
    let live = true;
    const load = () => {
      void api<{ companies: Company[]; season: Season }>(
        `leaderboard${selected ? `?season=${selected}` : ""}`,
      )
        .then((d) => {
          if (live) {
            setCompanies(d.companies);
            setSeason(d.season);
            setError("");
          }
        })
        .catch((e) => live && setError(e.message))
        .finally(() => live && setLoading(false));
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [selected]);
  useEffect(() => {
    void api<{ seasons: Season[] }>("seasons")
      .then((d) => setSeasons(d.seasons))
      .catch(() => {});
  }, []);
  const visible = companies.filter(
    (c) =>
      (category === "All" || c.category === category) &&
      `${c.name} ${c.tagline}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="page-container">
      <PageHeading
        eyebrow="THE WEEKLY LEADERBOARD"
        title="Good companies. Real backing."
        aside={
          season && (
            <div className="countdown-card">
              <span>
                {season.status === "archived"
                  ? "Season ended"
                  : "A fresh start in"}
              </span>
              <Countdown ends={season.ends_at} />
            </div>
          )
        }
      >
        A little community support. A little sponsorship. One transparent score.
      </PageHeading>
      <div className="board-stats">
        <div>
          <span>Companies in the running</span>
          <strong>{companies.length}</strong>
        </div>
        <div>
          <span>Total backing this week</span>
          <strong>
            {money(companies.reduce((n, c) => n + c.total_points, 0))}
            <span>pts</span>
          </strong>
        </div>
        <div>
          <span>The rules are simple</span>
          <p>
            1 community Back = 1 point
            <br />
            $1 sponsored backing = 1 point
          </p>
        </div>
      </div>
      <div className="board-controls">
        <CategoryFilter
          value={category}
          onChange={setCategory}
          allLabel="All"
        />
        <div className="board-search">
          <input
            aria-label="Search companies"
            placeholder="Find a company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Select season"
            value={selected}
            onChange={(e) => {
              setLoading(true);
              setSelected(e.target.value);
            }}
          >
            <option value="">This week</option>
            {seasons
              .filter((s) => s.status === "archived")
              .map((s) => (
                <option key={s.id} value={s.id}>
                  Week of{" "}
                  {new Date(s.starts_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </option>
              ))}
          </select>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="leaderboard-table">
        <div className="table-heading">
          <span>RANK</span>
          <span>COMPANY</span>
          <span>MOVEMENT</span>
          <span>TOTAL BACKING</span>
        </div>
        {loading ? (
          <div className="loading">
            <Spinner />
          </div>
        ) : visible.length ? (
          visible.map((c) => (
            <Link
              href={`/company/${c.slug}`}
              className={`board-row ${c.rank === 1 ? "first" : ""}`}
              key={c.id}
            >
              <span className="board-rank mono">
                {c.rank === 1 ? (
                  <Trophy size={20} />
                ) : (
                  String(c.rank).padStart(2, "0")
                )}
              </span>
              <div className="board-company">
                <Logo src={c.logo_url} name={c.name} size={43} />
                <div>
                  <strong>
                    {c.name}{" "}
                    {c.verification_status === "verified" && (
                      <Check size={13} />
                    )}
                  </strong>
                  <p>{c.tagline}</p>
                  <span className="mobile-category">{c.category}</span>
                </div>
                <span className="category-label">{c.category}</span>
              </div>
              <Movement company={c} />
              <strong className="board-score mono">
                {money(c.total_points)}
                <ArrowUpRight size={16} />
              </strong>
            </Link>
          ))
        ) : (
          <Empty title="A spot waiting to be claimed.">
            No companies match this view.{" "}
            <Link href="/submit">Submit yours.</Link>
          </Empty>
        )}
      </div>
      <p className="board-footnote">
        Rank = community backing + sponsored backing. Ties go to whoever reached
        the score first.{" "}
        <Link href="/rules">
          Read the rules <ArrowUpRight size={12} />
        </Link>
      </p>
    </div>
  );
}
type Detail = Company & { season: Season; gap: number };
export function CompanyPage({
  slug,
  initial,
  shareUrl,
}: {
  slug: string;
  initial?: Detail;
  shareUrl?: string;
}) {
  const { viewed, ready } = useLibrary();
  const [company, setCompany] = useState<Detail | undefined>(initial);
  const [backed, setBacked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [challenge, setChallenge] = useState(false);
  const [token, setToken] = useState<string>();
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    const data = await api<{ company: Detail; backed: boolean }>(
      `company/${slug}`,
    );
    setCompany(data.company);
    setBacked(data.backed);
  }, [slug]);
  const companyId = company?.id;
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    // The provider restores local history after hydration. Do not let that
    // restore overwrite a view recorded from server-rendered company data.
    if (!ready) return;
    if (companyId) {
      viewed(companyId);
    }
    if (companyId)
      void api("event", {
        companyId,
        kind: "profile",
        source: trafficSource(),
      }).catch(() => {});
  }, [companyId, viewed, ready]);
  async function back() {
    if (!company) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ valid: boolean }>("back", {
        companyId: company.id,
        turnstileToken: token,
        source: trafficSource(),
      });
      setNotice(
        r.valid
          ? "Your +1 is on the board. Thanks for backing something good."
          : "Your Back was received and is awaiting a trust review.",
      );
      setChallenge(false);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "CHALLENGE_REQUIRED")
        setChallenge(true);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!company)
    return (
      <div className="page-container">
        {error ? (
          <Alert>{error}</Alert>
        ) : (
          <div className="loading">
            <Spinner />
          </div>
        )}
      </div>
    );
  return (
    <div className="profile-container">
      <Link href="/leaderboard" className="back-link">
        ← The leaderboard
      </Link>
      <div className="profile-grid">
        <section>
          <div className="profile-hero">
            <img
              src={company.hero_image_url}
              alt={`${company.name} product preview`}
            />
            {company.is_demo && (
              <span className="demo-label">Staging demo company</span>
            )}
          </div>
          <div className="profile-identity">
            <Logo src={company.logo_url} name={company.name} size={66} />
            <div>
              <span className="eyebrow">{company.category}</span>
              <h1>
                {company.name}{" "}
                {company.verification_status === "verified" && (
                  <Check className="verified" size={21} />
                )}
              </h1>
            </div>
            <Visit company={company} />
          </div>
          <p className="profile-tagline">{company.tagline}</p>
          <p className="profile-description">{company.description}</p>
          <CompanyFacts company={company} />
          <div className="profile-actions">
            <SaveButton company={company} />
            <button
              className="button back-button"
              onClick={() => void back()}
              disabled={backed || busy}
            >
              {busy ? (
                <Spinner />
              ) : backed ? (
                <Check size={18} />
              ) : (
                <Plus size={18} />
              )}{" "}
              {backed ? "Backed this week" : "Give a Back +1"}
            </button>
            <Link
              href={`/sponsor/${company.slug}`}
              className="button secondary"
            >
              <Zap size={17} /> Sponsor {company.name}
            </Link>
          </div>
          {challenge && <Challenge onToken={setToken} />}{" "}
          {error && <Alert>{error}</Alert>}
          {notice && <Alert success>{notice}</Alert>}
          <div className="share-section">
            <span className="eyebrow">
              A LITTLE WORD OF MOUTH GOES A LONG WAY
            </span>
            <h2>Let the internet know.</h2>
            <Share company={company} canonicalUrl={shareUrl} />
          </div>
          <div className="profile-meta">
            <Link href={`/claim/${company.slug}`}>
              Is this your company? Claim it <ArrowUpRight size={13} />
            </Link>
            <button onClick={() => setReport(!report)} className="text-button">
              <Flag size={12} /> Report listing
            </button>
          </div>
          {report && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api("report", { companyId: company.id, reason });
                  setReport(false);
                  setNotice(
                    "Report received. A moderator will review this listing.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <label>
                What should we review?
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button className="button small">Send report</button>
            </form>
          )}
        </section>
        <aside className="score-panel">
          <div className="score-panel-heading">
            <span className="eyebrow">THIS WEEK’S BACKING</span>
            <span className="rank-pill">#{company.rank}</span>
          </div>
          <strong className="profile-score mono">
            {money(company.total_points)}
          </strong>
          <span className="muted">total backing</span>
          <div className="score-breakdown">
            <div>
              <Users size={17} />
              <span>Community backing</span>
              <strong className="mono">
                {money(company.community_points)}
              </strong>
            </div>
            <div>
              <Zap size={17} />
              <span>Sponsored backing</span>
              <strong className="mono">
                {money(company.sponsored_points)}
              </strong>
            </div>
          </div>
          <div
            className="backing-bar"
            role="img"
            aria-label={`${company.community_points} community points, ${company.sponsored_points} sponsored points`}
          >
            <span
              style={{
                width: `${company.total_points ? (company.community_points / company.total_points) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="score-context">
            {company.gap ? (
              <>
                Just <strong>{money(company.gap)} more backing</strong> to move
                up one spot.
              </>
            ) : (
              <>Leading the way. Keep the good things going.</>
            )}
          </p>
          <Movement company={company} />
          <div className="season-note">
            Fresh start in <Countdown ends={company.season.ends_at} />
          </div>
          <Link href="/rules" className="text-link">
            How the score works <ArrowRight size={14} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
export function HallOfFame({
  initial,
}: {
  initial?: { season: Season; companies: Company[] }[];
}) {
  const [winners, setWinners] = useState<
    { season: Season; companies: Company[] }[]
  >(initial || []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState("");
  useEffect(() => {
    void api<{ seasons: Season[] }>("seasons")
      .then(async (data) => {
        const results = await Promise.all(
          data.seasons
            .filter((s) => s.status === "archived")
            .map((s) =>
              api<{ season: Season; companies: Company[] }>(
                `leaderboard?season=${s.id}`,
              ),
            ),
        );
        setWinners(results);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="page-container">
      <PageHeading
        eyebrow="THE HALL OF FAME"
        title="A good week. A lasting spot."
      >
        The scoreboard resets. A little recognition sticks around.
      </PageHeading>
      {error && <Alert>{error}</Alert>}
      {loading ? (
        <div className="loading">
          <Spinner />
        </div>
      ) : winners.length ? (
        <div className="champion-grid">
          {winners.map(({ season, companies }) => (
            <article className="champion-card" key={season.id}>
              <Trophy className="champion-trophy" size={31} />
              <span className="eyebrow">
                WEEK OF{" "}
                {new Date(season.starts_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </span>
              {companies[0] ? (
                <>
                  <Logo
                    src={companies[0].logo_url}
                    name={companies[0].name}
                    size={64}
                  />
                  <h2>{companies[0].name}</h2>
                  <span className="champion-badge">WEEKLY CHAMPION</span>
                  <strong className="mono">
                    {money(companies[0].total_points)} backing
                  </strong>
                  <Link
                    href={`/company/${companies[0].slug}`}
                    className="text-link"
                  >
                    Meet the champion <ArrowUpRight size={14} />
                  </Link>
                  <a
                    href={`/api/share/${companies[0].slug}?season=${season.id}&badge=true`}
                    className="text-link"
                    download
                  >
                    Download winner badge <ArrowDown size={14} />
                  </a>
                </>
              ) : (
                <p>No champion this season.</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="The first chapter is being written.">
          Our first weekly champion will be crowned on Monday at 00:00 UTC.{" "}
          <Link href="/">Go give someone a Back.</Link>
        </Empty>
      )}
    </div>
  );
}
