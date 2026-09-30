"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Asterisk,
  Check,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
let identityRequest: Promise<void> | undefined;
export async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  options?: { keepalive?: boolean },
): Promise<T> {
  if (
    /^(feed\/|company\/[^/]+$|back$|skip$|event$|ads\/)/.test(
      path.split("?")[0],
    )
  ) {
    identityRequest ??= fetch("/api/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(
            "Could not initialize your private browser identity.",
          );
      })
      .catch((error) => {
        identityRequest = undefined;
        throw error;
      });
    await identityRequest;
  }
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    keepalive: options?.keepalive,
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || "Please try again.", data.code);
  return data;
}
export function money(n: number) {
  return new Intl.NumberFormat("en-US").format(n || 0);
}
export function Spinner() {
  return <span className="spinner" aria-label="Loading" />;
}
export function Alert({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div
      role={success ? "status" : "alert"}
      className={`alert ${success ? "success" : ""}`}
    >
      {children}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Asterisk size={32} />
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function Countdown({ ends }: { ends: string }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      const left = Math.max(0, new Date(ends).getTime() - Date.now());
      setTime(
        `${Math.floor(left / 86400000)}d ${Math.floor(left / 3600000) % 24}h ${Math.floor(left / 60000) % 60}m`,
      );
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [ends]);
  return <span className="mono">{time || "This week"}</span>;
}
export function Logo({
  src,
  name,
  size = 44,
}: {
  src: string;
  name: string;
  size?: number;
}) {
  return (
    <img
      className="company-logo"
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      onError={(e) => {
        if (!e.currentTarget.src.endsWith("/brand/icon-192.png"))
          e.currentTarget.src = "/brand/icon-192.png";
      }}
    />
  );
}
export function Visit({
  company,
}: {
  company: { id: string; url: string; name: string };
}) {
  return (
    <a
      href={company.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() =>
        void api("event", {
          companyId: company.id,
          kind: "outbound",
          source: trafficSource(),
        }).catch(() => {})
      }
      className="visit"
    >
      Visit website <ArrowUpRight size={16} />
      <span className="sr-only"> for {company.name}</span>
    </a>
  );
}
export function trafficSource() {
  if (typeof window === "undefined") return "direct";
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("ref") ||
    params.get("utm_source") ||
    (document.referrer && new URL(document.referrer).hostname) ||
    "direct"
  ).slice(0, 200);
}
export function Shell({
  children,
  active,
}: {
  children: ReactNode;
  active: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={active === "/" ? "site-shell discovery-shell" : "site-shell"}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Backing home">
            <span className="brand-mark">
              <Asterisk size={28} strokeWidth={3} />
            </span>
            backing<span className="brand-period">.</span>
          </Link>
          <nav
            className={open ? "nav open" : "nav"}
            aria-label="Main navigation"
          >
            {[
              ["/", "Discover"],
              ["/leaderboard", "Leaderboard"],
              ["/hall-of-fame", "Hall of fame"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={active === href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link href="/submit" className="button small header-submit">
            Submit a company <ArrowUpRight size={16} />
          </Link>
          <button
            className="icon-button mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div>
          <Link href="/" className="footer-brand">
            backing.
          </Link>
          <span>A little backing goes a long way.</span>
        </div>
        <nav aria-label="Footer">
          <Link href="/companies">Company directory</Link>
          <Link href="/categories">Categories</Link>
          <Link href="/about">The idea</Link>
          <Link href="/rules">The rules</Link>
          <Link href="/advertise">Advertise</Link>
          <Link href="/campaigns">Campaign reports</Link>
          <Link href="/dashboard">
            For founders <ArrowUpRight size={13} />
          </Link>
        </nav>
        <p>Made for the internet. Resets every Monday, 00:00 UTC.</p>
      </footer>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {aside}
    </div>
  );
}
export function Share({
  company,
  canonicalUrl,
}: {
  canonicalUrl?: string;
  company: {
    id: string;
    slug: string;
    name: string;
    rank: number;
    total_points: number;
    gap?: number;
  };
}) {
  const [copied, setCopied] = useState(false);
  const [base, setBase] = useState("");
  useEffect(() => setBase(window.location.origin), []);
  const url = `${canonicalUrl || `${base}/company/${company.slug}`}?ref=share`;
  const text = `${company.name} is #${company.rank} this week on Backing with ${money(company.total_points)} backing.${company.gap ? ` Just ${money(company.gap)} more to move up.` : ""} Give us a Back!`;
  function track() {
    void api("event", {
      companyId: company.id,
      kind: "share",
      source: trafficSource(),
    }).catch(() => {});
  }
  return (
    <div className="share">
      <button
        className="button secondary small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            track();
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check size={15} /> : <ArrowUpRight size={15} />}{" "}
        {copied ? "Copied!" : "Copy link"}
      </button>
      <a
        className="button secondary small"
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={track}
      >
        X
      </a>
      <a
        className="button secondary small"
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={track}
      >
        LinkedIn
      </a>
      <a
        className="button secondary small"
        href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={track}
      >
        WhatsApp
      </a>
      <a
        className="text-link"
        href={`/api/share/${company.slug}?format=portrait`}
        download={`${company.slug}-backing.png`}
      >
        Download card <ArrowRight size={14} />
      </a>
    </div>
  );
}
