"use client";
import { CompanyFacts } from "./library";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  Eye,
  MousePointerClick,
  Plus,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Alert, api, Empty, Logo, money, PageHeading, Spinner } from "./ui";
import { Auth, useUser } from "./forms";
import type { Company } from "@/lib/leaderboard";

type Analytics = {
  stats: Company;
  sources: { source: string; kind: string; count: number }[];
  history: { day: string; kind: string; count: number }[];
};
export function Dashboard() {
  const { user, setUser } = useUser();
  const [companies, setCompanies] = useState<
    (Company & { status: string; owner_id: string })[]
  >([]);
  const [claims, setClaims] = useState<
    { id: string; name: string; slug: string; method: string; status: string }[]
  >([]);
  const [selected, setSelected] = useState("");
  const [analytics, setAnalytics] = useState<Analytics>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    void api<{ companies: typeof companies; claims: typeof claims }>(
      "dashboard",
    )
      .then((d) => {
        setCompanies(d.companies);
        setClaims(d.claims);
        const owned = d.companies.find(
          (c) => c.owner_id === user.id && c.status === "approved",
        );
        if (owned) setSelected(owned.id);
      })
      .catch((e) => setError(e.message));
  }, [user]);
  useEffect(() => {
    if (!selected) return;
    void api<Analytics>(`company/${selected}/analytics`)
      .then(setAnalytics)
      .catch((e) => setError(e.message));
  }, [selected]);
  return (
    <div className="page-container">
      <PageHeading
        eyebrow="THE FOUNDER’S CORNER"
        title="See what your backing is doing."
        aside={
          user && (
            <div className="dashboard-account">
              <span>{user.email}</span>
              <button
                className="text-button"
                onClick={async () => {
                  await api("auth/logout", {});
                  setUser(null);
                }}
              >
                Sign out
              </button>
            </div>
          )
        }
      >
        Your company’s exposure, support, and visits. All in one place.
      </PageHeading>
      {error && <Alert>{error}</Alert>}
      {user === undefined ? (
        <Spinner />
      ) : !user ? (
        <Auth onSuccess={setUser} />
      ) : (
        <>
          {user.role === "admin" && (
            <Link className="button secondary" href="/admin">
              <ShieldCheck size={16} /> Open moderation
            </Link>
          )}
          <div className="dashboard-companies">
            {companies.map((c) => (
              <div
                className={`dashboard-company ${selected === c.id ? "selected" : ""}`}
                key={c.id}
              >
                <Logo src={c.logo_url} name={c.name} />
                <div>
                  <h3>{c.name}</h3>
                  <span className="status">
                    {c.status} · {c.verification_status}
                  </span>
                </div>
                {c.owner_id === user.id && c.status === "approved" ? (
                  <button
                    className="button secondary small"
                    onClick={() => setSelected(c.id)}
                  >
                    Analytics <BarChart3 size={14} />
                  </button>
                ) : c.status === "approved" ? (
                  <Link
                    href={`/claim/${c.slug}`}
                    className="button secondary small"
                  >
                    Claim <ArrowUpRight size={14} />
                  </Link>
                ) : (
                  <span className="muted">Awaiting review</span>
                )}
              </div>
            ))}
            <Link href="/submit" className="dashboard-company add">
              <Plus size={23} />
              <strong>Submit another company</strong>
              <ArrowUpRight size={16} />
            </Link>
          </div>
          {!companies.length && (
            <Empty title="Your next chapter starts here.">
              Submit a company or claim an existing listing to see your
              analytics.
            </Empty>
          )}
          {analytics?.stats && (
            <>
              <div className="section-label">
                <h2>This week, by the numbers</h2>
                <Link href={`/company/${analytics.stats.slug}`}>
                  View company <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="analytics-grid">
                {[
                  [Eye, "Card impressions", analytics.stats.impressions],
                  [
                    Users,
                    "Community backing",
                    analytics.stats.community_points,
                  ],
                  [MousePointerClick, "Website visits", analytics.stats.clicks],
                  [
                    Zap,
                    "Sponsored spend",
                    `$${money(analytics.stats.sponsored_points)}`,
                  ],
                  [
                    BarChart3,
                    "Backing rate",
                    `${analytics.stats.impressions ? ((analytics.stats.feed_backs / analytics.stats.impressions) * 100).toFixed(1) : 0}%`,
                  ],
                  [Eye, "Profile views", analytics.stats.profile_views],
                  [Plus, "Skips", analytics.stats.skips],
                  [Check, "Weekly rank", `#${analytics.stats.rank}`],
                ].map(([Icon, label, value]) => {
                  const I = Icon as typeof Eye;
                  return (
                    <div className="analytics-stat" key={String(label)}>
                      <I size={18} />
                      <span>{String(label)}</span>
                      <strong className="mono">
                        {typeof value === "number"
                          ? money(value)
                          : String(value)}
                      </strong>
                    </div>
                  );
                })}
              </div>
              {analytics.stats.is_demo && (
                <p className="form-note">
                  Demo companies include seeded community backs. Their backing
                  rate is not representative of real visitor behavior.
                </p>
              )}
              <div className="analytics-tables">
                <div className="form-card">
                  <h3>Where discovery comes from</h3>
                  {analytics.sources.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Event</th>
                          <th>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.sources.map((s, i) => (
                          <tr key={i}>
                            <td>{s.source}</td>
                            <td>{s.kind.replace(/_/g, " ")}</td>
                            <td className="mono">{s.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="muted">
                      Your first visitor is still on the way.
                    </p>
                  )}
                </div>
                <div className="form-card">
                  <h3>Daily activity</h3>
                  {analytics.history.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Event</th>
                          <th>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.history.map((s, i) => (
                          <tr key={i}>
                            <td>
                              {new Date(s.day).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                timeZone: "UTC",
                              })}
                            </td>
                            <td>{s.kind.replace(/_/g, " ")}</td>
                            <td className="mono">{s.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="muted">
                      Activity will appear as people discover you.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
          {claims.length > 0 && (
            <div className="form-card">
              <h3>Your ownership claims</h3>
              {claims.map((c) => (
                <div className="claim-row" key={c.id}>
                  <Link href={`/claim/${c.slug}`}>{c.name}</Link>
                  <span>{c.method}</span>
                  <span className="status">{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
type AdminData = {
  companies: {
    id: string;
    name: string;
    status: string;
    slug: string;
    is_demo: boolean;
    url: string;
    tagline: string;
    description: string;
    logo_url: string;
    hero_image_url: string;
    category: string;
    what_it_does: string;
    target_audience: string;
    pricing_model: string;
    pricing_note: string;
    tags: string[];
  }[];
  claims: { id: string; name: string; method: string; requester: string }[];
  backs: { id: string; name: string; risk_score: number; valid: boolean }[];
  reports: { id: string; name: string; reason: string; company_id: string }[];
  placements: {
    id: string;
    advertiser: string;
    creative: string;
    destination_url: string;
    logo_url: string;
    cta_label: string;
    hero_image_url: string;
    description: string;
    position: string;
    moderation_status: string;
    payment_status: string;
  }[];
  audit: { id: number; actor: string; action: string; created_at: string }[];
};
export function Admin() {
  const { user, setUser } = useUser();
  const [data, setData] = useState<AdminData>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("");
  async function load() {
    setData(await api<AdminData>("admin"));
  }
  useEffect(() => {
    if (user?.role === "admin") void load().catch((e) => setError(e.message));
  }, [user]);
  async function action(type: string, id: string, action: string) {
    setBusy(id);
    setError("");
    try {
      await api("admin/action", {
        type,
        id,
        action,
        reason: "Administrator review",
      });
      await load();
      setNotice("Review saved to the audit log.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const actions = (type: string, id: string, items: string[]) => (
    <div className="moderation-actions">
      {items.map((a) => (
        <button
          className={`button small ${a === "approve" || a === "restore" ? "" : "secondary"}`}
          key={a}
          disabled={busy === id}
          onClick={() => void action(type, id, a)}
        >
          {a}
        </button>
      ))}
    </div>
  );
  return (
    <div className="page-container">
      <PageHeading eyebrow="KEEP THE GOOD THINGS GOOD" title="Moderation desk.">
        Review companies, ownership, suspicious backs, and sponsor creatives.
      </PageHeading>
      {user === undefined ? (
        <Spinner />
      ) : !user ? (
        <Auth onSuccess={setUser} />
      ) : user.role !== "admin" ? (
        <Alert>Administrator access is required.</Alert>
      ) : (
        <>
          {error && <Alert>{error}</Alert>}
          {notice && <Alert success>{notice}</Alert>}
          {!data ? (
            <Spinner />
          ) : (
            <div className="moderation-sections">
              <section className="form-card">
                <h2>Companies</h2>
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter company names…"
                  aria-label="Filter companies"
                />
                {data.companies
                  .filter((c) =>
                    c.name.toLowerCase().includes(filter.toLowerCase()),
                  )
                  .map((c) => (
                    <div className="moderation-row" key={c.id}>
                      <div>
                        <strong>{c.name}</strong>
                        <p>
                          {c.status}
                          {c.is_demo ? " · staging demo" : ""} ·{" "}
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Review website ↗
                          </a>
                        </p>
                        <details className="submission-review">
                          <summary>Review submission</summary>
                          <p>
                            {c.category} · {c.tagline}
                          </p>
                          <p>{c.description}</p>
                          <CompanyFacts company={c} />
                          <div>
                            <Logo src={c.logo_url} name={c.name} />
                            <img
                              src={c.hero_image_url}
                              alt={`${c.name} submitted screenshot`}
                              width={220}
                            />
                          </div>
                          {c.status === "approved" && (
                            <Link href={`/company/${c.slug}`}>
                              Public profile ↗
                            </Link>
                          )}
                        </details>
                      </div>
                      {actions(
                        "company",
                        c.id,
                        c.status === "approved"
                          ? ["hide"]
                          : ["approve", "reject"],
                      )}
                    </div>
                  ))}
              </section>
              <section className="form-card">
                <h2>Ownership claims</h2>
                {data.claims.length ? (
                  data.claims.map((c) => (
                    <div className="moderation-row" key={c.id}>
                      <div>
                        <strong>{c.name}</strong>
                        <p>
                          {c.method} · {c.requester}
                        </p>
                      </div>
                      {actions("claim", c.id, ["approve", "reject"])}
                    </div>
                  ))
                ) : (
                  <p className="muted">No pending claims.</p>
                )}
              </section>
              <section className="form-card">
                <h2>Trust review</h2>
                {data.backs.length ? (
                  data.backs.map((b) => (
                    <div className="moderation-row" key={b.id}>
                      <div>
                        <strong>{b.name}</strong>
                        <p>
                          Risk: {b.risk_score} ·{" "}
                          {b.valid ? "counted" : "withheld"}
                          <br />
                          <code>{b.id}</code>
                        </p>
                      </div>
                      {actions("back", b.id, [
                        b.valid ? "invalidate" : "restore",
                      ])}
                    </div>
                  ))
                ) : (
                  <p className="muted">No flagged backing.</p>
                )}
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action(
                      "back",
                      String(f.get("id")),
                      String(f.get("action")),
                    );
                  }}
                >
                  <label>
                    Review a specific Back ID
                    <input name="id" required placeholder="Back UUID" />
                  </label>
                  <select name="action" aria-label="Back review action">
                    <option value="invalidate">Invalidate</option>
                    <option value="restore">Restore</option>
                  </select>
                  <button className="button small">Apply review</button>
                </form>
              </section>
              <section className="form-card">
                <h2>Abuse reports</h2>
                {data.reports.length ? (
                  data.reports.map((r) => (
                    <div className="moderation-row" key={r.id}>
                      <div>
                        <strong>{r.name}</strong>
                        <p>{r.reason}</p>
                      </div>
                      {actions("report", r.id, ["resolve"])}
                      {actions("company", r.company_id, ["hide"])}
                    </div>
                  ))
                ) : (
                  <p className="muted">No open reports.</p>
                )}
              </section>
              <section className="form-card">
                <h2>Sponsor creatives</h2>
                {data.placements.length ? (
                  data.placements.map((p) => (
                    <div className="moderation-row" key={p.id}>
                      <div>
                        <strong>
                          {p.advertiser} · {p.position}
                        </strong>
                        {p.hero_image_url && (
                          <img
                            className="moderation-screenshot"
                            src={p.hero_image_url}
                            alt={`${p.advertiser} creative preview`}
                          />
                        )}
                        <p>{p.description}</p>
                        {p.logo_url && (
                          <Logo
                            src={p.logo_url}
                            name={p.advertiser}
                            size={35}
                          />
                        )}
                        <p>Call to action: {p.cta_label}</p>
                        <p>
                          {p.creative}
                          <br />
                          <a
                            href={p.destination_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Review destination ↗
                          </a>
                          <br />
                          {p.payment_status} · {p.moderation_status}
                        </p>
                      </div>
                      {actions("placement", p.id, ["approve", "reject"])}
                    </div>
                  ))
                ) : (
                  <p className="muted">No placements yet.</p>
                )}
              </section>
              <section className="form-card">
                <h2>Recent audit trail</h2>
                {data.audit.map((a) => (
                  <div className="claim-row" key={a.id}>
                    <strong>{a.action}</strong>
                    <span>{a.actor}</span>
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
