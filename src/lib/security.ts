import { db } from "./db";
import { createClient } from "redis";
import { hash, HttpError } from "./auth";
import type { NextRequest } from "next/server";

let redis: ReturnType<typeof createClient> | undefined;
export function ip(req: NextRequest) {
  return process.env.TRUST_PROXY === "true"
    ? req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        "unknown"
    : "local";
}
export function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const configured = process.env.APP_URL;
  if (origin && origin !== new URL(configured || req.url).origin)
    throw new HttpError(403, "Request origin is not allowed.");
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Cross-site request rejected.");
}
export async function limit(key: string, max: number, seconds: number) {
  const safeKey = hash(key);
  if (process.env.REDIS_URL) {
    if (!redis) {
      redis = createClient({
        url: process.env.REDIS_URL,
        socket: { connectTimeout: 3000 },
      });
      redis.on("error", () => {});
    }
    try {
      if (!redis.isOpen) await redis.connect();
      const count = Number(
        await redis.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
          { keys: [`backing:${safeKey}`], arguments: [String(seconds)] },
        ),
      );
      if (count > max)
        throw new HttpError(
          429,
          "A little too fast. Please try again shortly.",
        );
      return;
    } catch (e) {
      if (e instanceof HttpError) throw e;
    }
  }
  const result = await db().query(
    `INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+make_interval(secs=>$2)) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<=now() THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END RETURNING count`,
    [safeKey, seconds],
  );
  if (result.rows[0].count > max)
    throw new HttpError(429, "A little too fast. Please try again shortly.");
}
export async function risk(
  req: NextRequest,
  deviceHash: string,
  turnstileToken?: string,
) {
  const address = ip(req);
  const ipHash = hash(address);
  const recent = (
    await db().query(
      `SELECT count(*) FILTER(WHERE device_hash=$1)::integer AS device_count,count(*)::integer AS ip_count FROM community_backs WHERE (device_hash=$1 OR ip_hash=$2) AND created_at>now()-interval '1 minute'`,
      [deviceHash, ipHash],
    )
  ).rows[0];
  let score =
    (recent.device_count > 12 ? 50 : 0) +
    (recent.ip_count > 40 ? 40 : 0) +
    (!req.headers.get("user-agent") ? 40 : 0);
  if (
    process.env.IPINFO_TOKEN &&
    address !== "local" &&
    address !== "unknown"
  ) {
    try {
      const response = await fetch(
        `https://ipinfo.io/${encodeURIComponent(address)}/json?token=${encodeURIComponent(process.env.IPINFO_TOKEN)}`,
        { signal: AbortSignal.timeout(2500) },
      );
      const data = await response.json();
      const asn = String(data.org || "").split(" ")[0];
      if (
        (process.env.BLOCKED_ASNS || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .includes(asn) ||
        data.privacy?.hosting ||
        data.privacy?.proxy ||
        data.privacy?.vpn
      )
        score += 50;
    } catch {}
  }
  if (score >= 40) {
    if (!process.env.TURNSTILE_SECRET_KEY)
      return { score, valid: false, ipHash };
    if (!turnstileToken)
      throw new HttpError(
        403,
        "Please complete the quick bot check.",
        "CHALLENGE_REQUIRED",
      );
    const result = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: turnstileToken,
          ...(address !== "local" ? { remoteip: address } : {}),
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    const verified = await result.json();
    if (
      !verified.success ||
      verified.action !== "back" ||
      (process.env.APP_URL &&
        verified.hostname !== new URL(process.env.APP_URL).hostname)
    )
      throw new HttpError(
        403,
        "Bot check failed. Please try again.",
        "CHALLENGE_REQUIRED",
      );
    score = Math.max(0, score - 50);
  }
  return { score, valid: score < 60, ipHash };
}
export function safeUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:")
    throw new HttpError(400, "Use a public HTTPS URL.");
  if (
    url.username ||
    url.password ||
    url.port ||
    url.hostname === "localhost" ||
    !url.hostname.includes(".") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      url.hostname,
    ) ||
    url.hostname.includes(":")
  )
    throw new HttpError(400, "Use a public website URL.");
  return url;
}
