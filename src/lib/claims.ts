import { randomUUID, randomBytes } from "node:crypto";
import { resolveTxt, resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";
import { db, transaction } from "./db";
import { HttpError } from "./auth";
import { safeUrl } from "./security";
import https from "node:https";

export function publicAddress(address: string) {
  if (isIP(address) === 4)
    return !/^(0\.|10\.|127\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.(168|0|88\.99)\.|198\.(1[89]|51\.100)\.|203\.0\.113\.|2(2[4-9]|[3-5]\d)\.)/.test(
      address,
    );
  if (isIP(address) === 6)
    return (
      !/^(::|fc|fd|fe80|ff)/i.test(address) &&
      !address.toLowerCase().includes("ffff:")
    );
  return false;
}
async function fetchHtml(value: string) {
  const url = safeUrl(value);
  const addresses = [
    ...(await resolve4(url.hostname).catch(() => [])),
    ...(await resolve6(url.hostname).catch(() => [])),
  ];
  if (!addresses.length || addresses.some((a) => !publicAddress(a)))
    throw new HttpError(400, "Website must resolve to a public address.");
  return new Promise<string>((resolve, reject) => {
    // Pin DNS resolution to the checked address; no redirects, private fetches, or DNS rebinding.
    const request = https.get(
      url,
      {
        lookup: (_hostname, _options, callback) =>
          callback(null, addresses[0], isIP(addresses[0])),
        timeout: 5000,
        headers: { "User-Agent": "Backing-Verification/1.0" },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(
            new HttpError(
              400,
              "Website must return HTTP 200 without redirects.",
            ),
          );
          return;
        }
        let html = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          html += chunk;
          if (html.length > 1000000) {
            request.destroy();
            reject(new HttpError(400, "Website response is too large."));
          }
        });
        response.on("end", () => resolve(html));
      },
    );
    request.on("timeout", () =>
      request.destroy(new Error("Website verification timed out.")),
    );
    request.on("error", reject);
  });
}
export async function startClaim(
  companyId: string,
  userId: string,
  method: string,
  email?: string,
) {
  const company = (
    await db().query(
      "SELECT * FROM companies WHERE id=$1 AND status='approved'",
      [companyId],
    )
  ).rows[0];
  if (!company) throw new HttpError(404, "Company not found.");
  if (company.owner_id && company.owner_id !== userId)
    throw new HttpError(409, "This company already has a verified owner.");
  const domain = new URL(company.url).hostname.replace(/^www\./, "");
  const token = randomBytes(24).toString("hex");
  const id = randomUUID();
  if (method === "email") {
    if (!email || email.split("@")[1]?.toLowerCase() !== domain)
      throw new HttpError(400, `Use an email address at ${domain}.`);
    if (!process.env.RESEND_API_KEY || !process.env.APP_URL)
      throw new HttpError(
        503,
        "Email verification is awaiting email service configuration. DNS, HTML, and manual verification are available.",
      );
  }
  await db().query(
    "INSERT INTO claims(id,company_id,user_id,method,token,email) VALUES($1,$2,$3,$4,$5,$6)",
    [id, companyId, userId, method, token, email || null],
  );
  if (method === "email") {
    const link = `${process.env.APP_URL}/claim/${company.slug}?token=${token}`;
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email],
        subject: "Verify your company on Backing",
        text: `Confirm ownership of ${company.name}: ${link}`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!sent.ok)
      throw new HttpError(
        502,
        "Verification email could not be sent. Try another verification method.",
      );
  }
  return { id, token: method === "email" ? undefined : token, domain, method };
}
export async function verifyClaim(userId: string, token: string) {
  const claim = (
    await db().query(
      "SELECT cl.*,c.url FROM claims cl JOIN companies c ON c.id=cl.company_id WHERE cl.token=$1 AND cl.user_id=$2 AND cl.expires_at>now() AND cl.status=$3",
      [token, userId, "pending"],
    )
  ).rows[0];
  if (!claim) throw new HttpError(404, "Claim not found or expired.");
  const domain = new URL(claim.url).hostname.replace(/^www\./, "");
  if (claim.method === "dns") {
    const records = await resolveTxt(`_backing.${domain}`).catch(() => []);
    if (!records.some((r) => r.join("") === `backing-verification=${token}`))
      throw new HttpError(
        400,
        "DNS record not found yet. Wait for propagation and retry.",
      );
  } else if (claim.method === "html") {
    const html = await fetchHtml(claim.url);
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    if (
      !tags.some(
        (tag) =>
          /name\s*=\s*["']backing-verification["']/i.test(tag) &&
          tag.includes(`"${token}"`),
      )
    )
      throw new HttpError(400, "Verification meta tag was not found.");
  } else if (claim.method === "manual")
    throw new HttpError(400, "A moderator will review your manual claim.");
  await approveClaim(claim.id, userId);
  return { verified: true };
}
export async function approveClaim(id: string, actor: string) {
  await transaction(async (c) => {
    const claim = (
      await c.query("SELECT * FROM claims WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!claim) throw new HttpError(404, "Claim not found.");
    const company = (
      await c.query("SELECT owner_id FROM companies WHERE id=$1 FOR UPDATE", [
        claim.company_id,
      ])
    ).rows[0];
    if (company.owner_id && company.owner_id !== claim.user_id)
      throw new HttpError(409, "Company has already been claimed.");
    await c.query(
      "UPDATE companies SET owner_id=$2,verification_status='verified' WHERE id=$1",
      [claim.company_id, claim.user_id],
    );
    await c.query("UPDATE claims SET status='verified' WHERE id=$1", [id]);
    await c.query(
      "INSERT INTO audit_log(actor,action,target_id) VALUES($1,$2,$3)",
      [actor, "claim.approve", id],
    );
  });
}
