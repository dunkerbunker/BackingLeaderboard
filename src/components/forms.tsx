"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle,
  LockKeyhole,
  Plus,
  Upload,
  Zap,
} from "lucide-react";
import { Alert, api, Logo, money, PageHeading, Spinner } from "./ui";
import type { Company } from "@/lib/leaderboard";
import { categories } from "@/lib/validation";

type User = { id: string; email: string; role: string };
export function useUser() {
  const [user, setUser] = useState<User | null | undefined>();
  useEffect(() => {
    void api<{ user: User | null }>("auth/session")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);
  return { user, setUser };
}
export function Auth({ onSuccess }: { onSuccess: (user: User) => void }) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const data = await api<{ user: User }>(
        register ? "auth/register" : "auth/login",
        { email: form.get("email"), password: form.get("password") },
      );
      onSuccess(data.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-card">
      <span className="form-icon">
        <LockKeyhole size={23} />
      </span>
      <h2>{register ? "A home for your company." : "Welcome back."}</h2>
      <p>
        {register
          ? "Create an account to manage a company or book advertising with private campaign reports."
          : "Sign in to manage companies and advertiser reports. Discovery is open to everyone."}
      </p>
      <form onSubmit={submit}>
        <label>
          Email address
          <input
            name="email"
            type="email"
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={10}
            maxLength={128}
            required
            autoComplete={register ? "new-password" : "current-password"}
            placeholder="At least 10 characters"
          />
        </label>
        {error && <Alert>{error}</Alert>}
        <button className="button back-button full" disabled={busy}>
          {busy ? <Spinner /> : null}
          {register ? "Create account" : "Sign in"}
          <ArrowRight size={16} />
        </button>
      </form>
      <button
        className="text-button"
        onClick={() => {
          setRegister(!register);
          setError("");
        }}
      >
        {register
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </div>
  );
}
export function UploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="upload-field">
      <label>
        {label}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload an image"
          required
        />
      </label>
      <label className="upload-button">
        <Upload size={15} />
        {busy ? "Uploading…" : "Upload image"}
        <input
          type="file"
          aria-label={`Upload ${label.toLowerCase()}`}
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              setError("Choose an image under 5 MB.");
              e.target.value = "";
              return;
            }
            setBusy(true);
            setError("");
            try {
              const form = new FormData();
              form.set("file", file);
              const res = await fetch("/api/upload", {
                method: "POST",
                body: form,
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              onChange(data.url);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {value && (
        <img src={value} alt={`${label} preview`} className="upload-preview" />
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
export function Submit() {
  const { user, setUser } = useUser();
  const [logo, setLogo] = useState("");
  const [hero, setHero] = useState("");
  const [tagline, setTagline] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api("company", {
        name: form.get("name"),
        url: form.get("url"),
        tagline,
        description: form.get("description"),
        what_it_does: form.get("what_it_does"),
        target_audience: form.get("target_audience"),
        pricing_model: form.get("pricing_model"),
        pricing_note: form.get("pricing_note"),
        tags: String(form.get("tags") || "")
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        category: form.get("category"),
        logo_url: logo,
        hero_image_url: hero,
        social_url: form.get("social_url"),
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="narrow-container">
      <PageHeading
        eyebrow="FOR THE BUILDERS"
        title="Put something good in the stack."
      >
        Small company. Big idea. Every listing gets a fair chance to be
        discovered.
      </PageHeading>
      {user === undefined ? (
        <div className="loading">
          <Spinner />
        </div>
      ) : !user ? (
        <Auth onSuccess={setUser} />
      ) : done ? (
        <div className="success-card">
          <CheckCircle size={39} />
          <h2>You’re in the queue.</h2>
          <p>
            We’ll review your company before it goes live. Claim ownership after
            approval to unlock your analytics.
          </p>
          <Link className="button" href="/dashboard">
            Go to your dashboard <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <form className="form-card" onSubmit={submit}>
          <div className="form-row">
            <label>
              Company name
              <input
                name="name"
                placeholder="Your next favorite company"
                minLength={2}
                maxLength={60}
                required
              />
            </label>
            <label>
              Category
              <select name="category" required>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Website URL
            <input
              name="url"
              type="url"
              placeholder="https://yourcompany.com"
              required
            />
          </label>
          <label className="tagline-label">
            Tagline <span>{tagline.length}/80</span>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="What do you do, in one good sentence?"
              minLength={5}
              maxLength={80}
              required
            />
          </label>
          <label>
            A little more about you
            <textarea
              name="description"
              placeholder="What makes your product worth discovering?"
              maxLength={2000}
            />
          </label>
          <label>
            What does it do?
            <textarea
              name="what_it_does"
              maxLength={400}
              minLength={10}
              required
              placeholder="Describe the useful thing your product does, in plain English."
            />
          </label>
          <label>
            Who is it for?
            <input
              name="target_audience"
              maxLength={200}
              required
              placeholder="Independent designers, small engineering teams…"
            />
          </label>
          <div className="form-row">
            <label>
              Pricing
              <select name="pricing_model" defaultValue="freemium">
                <option value="free">Free</option>
                <option value="freemium">Free + paid plans</option>
                <option value="paid">Paid</option>
                <option value="contact">Contact for pricing</option>
              </select>
            </label>
            <label>
              Pricing detail
              <input
                name="pricing_note"
                maxLength={200}
                placeholder="Free for individuals; teams from $12/month"
              />
            </label>
          </div>
          <label>
            Useful tags
            <input
              name="tags"
              maxLength={247}
              placeholder="open source, collaboration, no code"
            />
            <small>
              Up to 8 comma-separated tags. Letters, numbers, spaces, +, dots
              and hyphens.
            </small>
          </label>
          <div className="form-row">
            <UploadField label="Company logo" value={logo} onChange={setLogo} />
            <UploadField
              label="Product screenshot"
              value={hero}
              onChange={setHero}
            />
          </div>
          <label>
            X or LinkedIn URL <span className="optional">optional</span>
            <input
              name="social_url"
              type="url"
              placeholder="https://x.com/yourcompany"
            />
          </label>
          <p className="form-note">
            PNG, JPG, or WebP, up to 5 MB. Listings are reviewed for legitimacy
            before appearing in the feed. Submission is free.
          </p>
          {error && <Alert>{error}</Alert>}
          <button className="button back-button full" disabled={busy}>
            {busy ? <Spinner /> : <Plus size={19} />}Submit your company
          </button>
        </form>
      )}
    </div>
  );
}
export function Claim({ slug }: { slug: string }) {
  const { user, setUser } = useUser();
  const [company, setCompany] = useState<Company>();
  const [method, setMethod] = useState("dns");
  const [email, setEmail] = useState("");
  const [claim, setClaim] = useState<{
    token?: string;
    domain: string;
    method: string;
  }>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    void api<{ company: Company }>(`company/${slug}`)
      .then((d) => setCompany(d.company))
      .catch((e) => setError(e.message));
  }, [slug]);
  const verify = useCallback(async (token: string) => {
    setBusy(true);
    setError("");
    try {
      await api("claim/verify", { token });
      setVerified(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (user && token) void verify(token);
  }, [user, verify]);
  return (
    <div className="narrow-container">
      <PageHeading
        eyebrow="MAKE IT OFFICIAL"
        title={`Claim ${company?.name || "your company"}.`}
      >
        Prove ownership to unlock your private performance dashboard.
      </PageHeading>
      {error && <Alert>{error}</Alert>}
      {user === undefined ? (
        <Spinner />
      ) : !user ? (
        <Auth onSuccess={setUser} />
      ) : verified ? (
        <div className="success-card">
          <CheckCircle size={39} />
          <h2>Verified. Welcome aboard.</h2>
          <Link href="/dashboard" className="button">
            Open your dashboard <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        company && (
          <div className="form-card">
            <div className="claim-methods">
              {[
                ["dns", "DNS record"],
                ["html", "HTML tag"],
                ["email", "Domain email"],
                ["manual", "Manual review"],
              ].map(([id, label]) => (
                <button
                  className={method === id ? "active" : ""}
                  key={id}
                  onClick={() => {
                    setMethod(id);
                    setClaim(undefined);
                    setNotice("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p>
              {method === "dns"
                ? "Add a TXT record to your company domain. A reliable way to show it’s yours."
                : method === "html"
                  ? "Add a verification meta tag to your website’s home page."
                  : method === "email"
                    ? "Receive a verification link at your company’s domain."
                    : "Request a moderator review. We may contact you for proof before approving."}
            </p>
            {method === "email" && (
              <label>
                Company-domain email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`you@${new URL(company.url).hostname.replace(/^www\./, "")}`}
                />
              </label>
            )}
            {!claim ? (
              <button
                className="button back-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const data = await api<{
                      token?: string;
                      domain: string;
                      method: string;
                    }>(`company/${company.id}/claim`, {
                      method,
                      ...(method === "email" ? { email } : {}),
                    });
                    setClaim(data);
                    if (method === "email")
                      setNotice(
                        "Check your company inbox for the verification link.",
                      );
                    if (method === "manual")
                      setNotice(
                        "Your claim is queued for moderator review. Check its status on your dashboard.",
                      );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Spinner /> : null}
                {method === "manual"
                  ? "Request review"
                  : "Start verification"}{" "}
                <ArrowRight size={15} />
              </button>
            ) : (
              <>
                {method === "dns" && (
                  <div className="verification-instructions">
                    <label>
                      TXT record name<code>_backing.{claim.domain}</code>
                    </label>
                    <label>
                      TXT record value
                      <code>backing-verification={claim.token}</code>
                    </label>
                    <p>
                      DNS providers usually want just <code>_backing</code> as
                      the record name. Allow time for propagation.
                    </p>
                  </div>
                )}
                {method === "html" && (
                  <div className="verification-instructions">
                    <label>
                      Place this in your homepage’s &lt;head&gt;
                      <code>{`<meta name="backing-verification" content="${claim.token}" />`}</code>
                    </label>
                  </div>
                )}
                {claim.token && method !== "manual" && (
                  <button
                    className="button back-button"
                    disabled={busy}
                    onClick={() => void verify(claim.token!)}
                  >
                    {busy ? <Spinner /> : <Check size={16} />} Verify ownership
                  </button>
                )}
              </>
            )}
            {notice && <Alert success>{notice}</Alert>}
          </div>
        )
      )}
    </div>
  );
}
export function Sponsor({ slug }: { slug: string }) {
  const [company, setCompany] = useState<Company>();
  const [amount, setAmount] = useState(50);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    void api<{ company: Company }>(`company/${slug}`)
      .then((d) => setCompany(d.company))
      .catch((e) => setError(e.message));
  }, [slug]);
  useEffect(() => {
    const order = new URLSearchParams(window.location.search).get("order");
    if (!order) return;
    const check = () =>
      void api<{ payment_status: string }>(`order?id=${order}`)
        .then((d) => setStatus(d.payment_status))
        .catch((e) => setError(e.message));
    check();
    const timer = setInterval(check, 4000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="narrow-container">
      <PageHeading
        eyebrow="A LITTLE EXTRA MOMENTUM"
        title={`Back ${company?.name || "a good company"}.`}
      >
        Turn a little sponsorship into a bigger spotlight. Every US dollar adds
        one point.
      </PageHeading>
      {status && (
        <Alert success={status === "succeeded"}>
          {status === "succeeded"
            ? "Payment confirmed. Your sponsored backing is on the board."
            : status === "pending"
              ? "Waiting for secure payment confirmation. Your points will appear after Dodo confirms payment."
              : `Payment status: ${status.replace(/_/g, " ")}.`}
        </Alert>
      )}
      {company && (
        <div className="sponsorship-grid">
          <div className="form-card">
            <div className="sponsor-company">
              <Logo src={company.logo_url} name={company.name} size={47} />
              <div>
                <h3>{company.name}</h3>
                <p>{company.tagline}</p>
              </div>
            </div>
            <span className="field-label">Choose your backing</span>
            <div className="amount-options">
              {[10, 50, 100, 500].map((n) => (
                <button
                  className={amount === n ? "active" : ""}
                  key={n}
                  onClick={() => setAmount(n)}
                >
                  <strong>${n}</strong>
                  <span>+{n} points</span>
                </button>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const data = await api<{ checkoutUrl: string }>(
                    "sponsorship/checkout",
                    { companyId: company.id, amount, email },
                  );
                  window.location.assign(data.checkoutUrl);
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              <label>
                Or make it your own <span className="optional">USD</span>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                />
              </label>
              <label>
                Receipt email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </label>
              <div className="checkout-summary">
                <span>Sponsored backing</span>
                <strong>+{money(amount)} points</strong>
              </div>
              {error && <Alert>{error}</Alert>}
              <button className="button back-button full" disabled={busy}>
                {busy ? <Spinner /> : <Zap size={18} />} Sponsor for $
                {money(amount)} <ArrowUpRight size={17} />
              </button>
            </form>
            <p className="form-note">
              Secure hosted checkout by Dodo Payments. Applicable taxes may be
              added at checkout.
            </p>
          </div>
          <div className="sponsorship-explainer">
            <h3>Backing, with no blurred lines.</h3>
            <ul>
              <li>
                <Check size={15} /> US$1 = exactly one sponsored point.
              </li>
              <li>
                <Check size={15} /> Clearly separated from community backs.
              </li>
              <li>
                <Check size={15} /> Helps this week’s score.
              </li>
              <li>
                <Check size={15} /> Never changes organic feed frequency.
              </li>
            </ul>
            <p>
              Your backing counts in the season when payment is confirmed.
              Scores reset each Monday at 00:00 UTC.
            </p>
            <Link href="/rules">
              The full rules <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
export function Advertise() {
  const { user, setUser } = useUser();
  const [logo, setLogo] = useState("");
  const [hero, setHero] = useState("");
  const [position, setPosition] = useState("deck");
  const [days, setDays] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookings, setBookings] = useState<
    { position: string; starts_at: string; ends_at: string }[]
  >([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    void api<{ bookings: typeof bookings }>("placement-availability")
      .then((d) => setBookings(d.bookings))
      .catch(() => {});
    const id = new URLSearchParams(window.location.search).get("order");
    if (id)
      void api<{ payment_status: string }>(`order?id=${id}`)
        .then((d) => setStatus(d.payment_status))
        .catch((e) => setError(e.message));
  }, []);
  const price =
    ({ top: 49, bottom: 29, both: 69, deck: 49 } as Record<string, number>)[
      position
    ] * days;
  return (
    <div className="narrow-container">
      <PageHeading
        eyebrow="SPONSOR THE DISCOVERY"
        title="A small spot. A good crowd."
      >
        Get your company in front of curious people, right where discovery
        happens.
      </PageHeading>
      {status && (
        <Alert success={status === "succeeded"}>
          {status === "succeeded"
            ? "Payment confirmed. Your creative is awaiting moderator approval."
            : `Payment status: ${status}. Placements go live after payment and creative approval.`}
        </Alert>
      )}
      <Link href="/campaigns" className="button">
        Your campaign reports <ArrowRight size={15} />
      </Link>
      <div className="ad-pricing">
        {[
          ["deck", "Sponsor card", 49],
          ["top", "Top strip", 49],
          ["bottom", "Bottom strip", 29],
          ["both", "Both strips", 69],
        ].map(([id, label, price]) => (
          <button
            key={id}
            onClick={() => setPosition(String(id))}
            className={position === id ? "active" : ""}
          >
            <span>{label}</span>
            <strong>
              ${price}
              <small>/day</small>
            </strong>
            <span>
              {id === "both"
                ? "A little more presence."
                : id === "deck"
                  ? "A full card after every 6 discoveries."
                  : "Compact. Clearly sponsored."}
            </span>
          </button>
        ))}
      </div>
      {user === undefined ? (
        <Spinner />
      ) : !user ? (
        <Auth onSuccess={setUser} />
      ) : (
        <div className="form-card">
          <form
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const data = new FormData(e.currentTarget);
              try {
                const checkout = await api<{ checkoutUrl: string }>(
                  "placements/checkout",
                  {
                    advertiser: data.get("advertiser"),
                    description: data.get("description"),
                    logo_url: logo,
                    hero_image_url: hero,
                    cta_label: data.get("cta_label"),
                    creative: data.get("creative"),
                    destination_url: data.get("destination_url"),
                    position,
                    date: data.get("date"),
                    days,
                    email: data.get("email"),
                  },
                );
                window.location.assign(checkout.checkoutUrl);
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            <div className="form-row">
              <label>
                Advertiser name
                <input
                  name="advertiser"
                  minLength={2}
                  maxLength={60}
                  required
                  placeholder="Your company"
                />
              </label>
              <label>
                Receipt email
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@company.com"
                />
              </label>
            </div>
            <label>
              A short, good line
              <input
                name="creative"
                minLength={5}
                maxLength={100}
                required
                placeholder="What should people know about you?"
              />
            </label>
            <label>
              What makes this worth a look?
              <textarea
                name="description"
                minLength={10}
                maxLength={400}
                required
                placeholder="Explain what your product helps people do."
              />
            </label>
            <UploadField label="Sponsor logo" value={logo} onChange={setLogo} />
            <UploadField
              label="Real product screenshot"
              value={hero}
              onChange={setHero}
            />
            <label>
              Call to action
              <input
                name="cta_label"
                minLength={2}
                maxLength={30}
                defaultValue="Visit sponsor"
                required
              />
            </label>
            <label>
              Destination URL
              <input
                name="destination_url"
                type="url"
                required
                placeholder="https://yourcompany.com"
              />
            </label>
            <div className="form-row">
              <label>
                Start date <span className="optional">UTC</span>
                <input
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  min={new Date().toISOString().slice(0, 10)}
                  required
                />
              </label>
              <label>
                Number of days
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  required
                />
              </label>
            </div>
            <div className="checkout-summary">
              <span>
                {days} day{days !== 1 ? "s" : ""} · {position} placement
              </span>
              <strong>${money(price)}</strong>
            </div>
            {error && <Alert>{error}</Alert>}
            <button className="button back-button full" disabled={busy}>
              {busy ? <Spinner /> : null}Book your spot <ArrowRight size={16} />
            </button>
            <p className="form-note">
              Creative is moderated before going live. Sponsor cards and strips
              are separate ad inventory and contribute zero leaderboard points.
              Dates begin at 00:00 UTC; booking today covers the remainder of
              today.
            </p>
          </form>
        </div>
      )}
      {bookings.length > 0 && (
        <div className="bookings">
          <h3>Already on the calendar</h3>
          {bookings.map((b, i) => (
            <p key={i}>
              {b.position} · {new Date(b.starts_at).toLocaleDateString()} —{" "}
              {new Date(b.ends_at).toLocaleDateString()}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
