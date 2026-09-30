"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { Auth, useUser } from "./forms";
import { Alert, api, money, PageHeading, Spinner, Empty } from "./ui";
type Campaign = {
  id: string;
  advertiser: string;
  creative: string;
  position: string;
  starts_at: string;
  ends_at: string;
  amount_usd: number;
  payment_status: string;
  moderation_status: string;
  is_demo: boolean;
};
type Metrics = {
  served: number;
  viewable: number;
  audience: number;
  unique_clicks: number;
  outbound_visits: number;
};
type Report = {
  campaign: Campaign;
  stats: Metrics;
  daily: (Metrics & { day: string })[];
  breakdowns: Record<string, (Metrics & { label: string })[]>;
};
export function Campaigns() {
  const { user, setUser } = useUser();
  const [campaigns, setCampaigns] = useState<Campaign[]>();
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refresh = () =>
      void api<{ campaigns: Campaign[] }>("campaigns")
        .then((d) => {
          if (!cancelled) {
            setCampaigns(d.campaigns);
            setSelected(
              (id) =>
                id ||
                new URLSearchParams(window.location.search).get("order") ||
                d.campaigns[0]?.id ||
                "",
            );
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);
  useEffect(() => {
    if (!user || !selected) return;
    let cancelled = false;
    setBusy(true);
    setReport(undefined);
    setError("");
    const refresh = () =>
      void api<Report>(`campaigns/${selected}`)
        .then((d) => {
          if (!cancelled) {
            setReport(d);
            setError("");
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, selected]);
  return (
    <div className="page-container campaign-world">
      <PageHeading
        eyebrow="FOR THE PEOPLE BACKING DISCOVERY"
        title="Your audience. In plain sight."
      >
        Every placement has its own report. No leaderboard points or company
        visits mixed in.
      </PageHeading>
      <Link href="/advertise" className="button">
        <Megaphone size={17} /> Book a placement <ArrowRight size={15} />
      </Link>
      {error && <Alert>{error}</Alert>}
      {user === undefined ? (
        <Spinner />
      ) : !user ? (
        <Auth onSuccess={setUser} />
      ) : !campaigns ? (
        <div className="loading">
          <Spinner />
        </div>
      ) : campaigns.length === 0 ? (
        <Empty title="Your first good impression starts here.">
          Book a sponsor card or strip. Dodo confirms payment, then a moderator
          approves the creative before it goes live.
        </Empty>
      ) : (
        <div className="campaign-layout">
          <aside className="campaign-list">
            {campaigns.map((c) => (
              <button
                key={c.id}
                aria-pressed={selected === c.id}
                onClick={() => {
                  setSelected(c.id);
                  history.replaceState(null, "", `/campaigns?order=${c.id}`);
                }}
              >
                <span>{c.advertiser}</span>
                <strong>{c.creative}</strong>
                <small>
                  {c.position} · {c.payment_status.replaceAll("_", " ")} ·{" "}
                  {c.moderation_status}
                </small>
              </button>
            ))}
          </aside>
          <section className="campaign-report" aria-busy={busy}>
            {busy ? (
              <Spinner />
            ) : (
              report && (
                <>
                  <div className="campaign-report-heading">
                    <span className="eyebrow">
                      {report.campaign.position.toUpperCase()} PLACEMENT
                    </span>
                    <h2>{report.campaign.creative}</h2>
                    <p>
                      {new Date(report.campaign.starts_at).toLocaleDateString()}{" "}
                      – {new Date(report.campaign.ends_at).toLocaleDateString()}{" "}
                      ·{" "}
                      {report.campaign.is_demo
                        ? "Unpaid staging preview"
                        : `$${money(report.campaign.amount_usd)}`}{" "}
                      · Payment: {report.campaign.payment_status} · Review:{" "}
                      {report.campaign.moderation_status}
                    </p>
                  </div>
                  <div className="campaign-metrics">
                    {(
                      [
                        ["audience", "Unique audience"],
                        ["served", "Served impressions"],
                        ["viewable", "Viewable impressions"],
                        ["unique_clicks", "Unique clickers"],
                        ["outbound_visits", "Tagged outbound visits"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <span>{label}</span>
                        <strong>{money(report.stats[key])}</strong>
                      </div>
                    ))}
                    <div>
                      <span>Outbound click rate</span>
                      <strong>
                        {report.stats.served
                          ? (
                              (report.stats.outbound_visits /
                                report.stats.served) *
                              100
                            ).toFixed(1)
                          : "0.0"}
                        %
                      </strong>
                    </div>
                  </div>
                  <p className="metrics-note">
                    Audience and clickers are unique browser identities, not
                    identified people. Viewable means at least 50% visible for 1
                    continuous second in a focused tab. Tagged visits count
                    unique clicked exposures redirected with UTM tags;
                    destination page loads and conversions aren’t measured.
                    These are first-party browser measurements, not
                    independently audited impressions. Refreshes every 15
                    seconds.
                  </p>
                  <ReportTable
                    title="Daily performance · UTC"
                    rows={report.daily.map((row) => ({
                      ...row,
                      label: row.day,
                    }))}
                  />
                  {Object.entries(report.breakdowns).map(([key, rows]) => (
                    <ReportTable
                      key={key}
                      title={
                        key === "surface"
                          ? "Where you appeared"
                          : key === "category"
                            ? "Visitor’s discovery category"
                            : "Traffic sources"
                      }
                      rows={rows}
                    />
                  ))}
                </>
              )
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function ReportTable({
  title,
  rows,
}: {
  title: string;
  rows: (Metrics & { label: string })[];
}) {
  return (
    <div className="campaign-table">
      <h3>{title}</h3>
      {!rows.length ? (
        <p>No activity recorded yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Segment</th>
                <th>Audience</th>
                <th>Served</th>
                <th>Viewable</th>
                <th>Clickers</th>
                <th>Outbound</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  <td>{money(row.audience)}</td>
                  <td>{money(row.served)}</td>
                  <td>{money(row.viewable)}</td>
                  <td>{money(row.unique_clicks)}</td>
                  <td>{money(row.outbound_visits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
