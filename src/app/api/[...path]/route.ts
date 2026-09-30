import { NextRequest, NextResponse } from "next/server";
import { limitedBody } from "@/lib/http";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { db, transaction } from "@/lib/db";
import {
  companyBySlug,
  currentSeason,
  leaderboard,
  recordEvent,
  rankedSql,
} from "@/lib/leaderboard";
import { checkOrigin, ip, limit, risk, safeUrl } from "@/lib/security";
import {
  checkPassword,
  cookieOptions,
  device,
  HttpError,
  passwordHash,
  requireAdmin,
  requireUser,
  safeEqual,
  session,
  sign,
} from "@/lib/auth";
import {
  authSchema,
  backSchema,
  checkoutSchema,
  companySchema,
  placementSchema,
} from "@/lib/validation";
import {
  applyPaymentEvent,
  normalizePaymentEvent,
  backingCheckout,
  paymentClient,
  placementCheckout,
  type PaymentEvent,
} from "@/lib/payments";
import { normalizeCategory } from "@/lib/taxonomy";
import { catalog } from "@/lib/discovery";
import {
  activePlacements,
  adEvent,
  adClick,
  campaignReport,
} from "@/lib/advertising";
import { approveClaim, startClaim, verifyClaim } from "@/lib/claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message, code: error.code }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      400,
    );
  if (error instanceof SyntaxError)
    return json({ error: "Invalid request body." }, 400);
  console.error(
    "API request failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return json({ error: "Something went wrong. Please try again." }, 500);
}
export async function GET(req: NextRequest, ctx: Context) {
  try {
    const path = (await ctx.params).path;
    const route = path.join("/");
    await limit(`get:${ip(req)}:${route.split("/")[0]}`, 240, 60);
    if (route === "health") {
      await db().query("SELECT 1");
      return json({ status: "ok", environment: process.env.APP_ENV });
    }
    if (route === "auth/session") {
      const s = await session();
      return json({
        user: s ? { id: s.sub, email: s.email, role: s.role } : null,
      });
    }
    if (route === "catalog")
      return json(await catalog(req.nextUrl.searchParams));
    if (route === "ads/click")
      return NextResponse.redirect(
        await adClick(req.nextUrl.searchParams, await device()),
        { status: 302, headers: { "Cache-Control": "no-store" } },
      );
    if (path[0] === "campaigns") {
      const user = await requireUser();
      if (path.length === 2)
        return json(
          await campaignReport(
            path[1],
            String(user.sub),
            user.role === "admin",
          ),
        );
      return json({
        campaigns: (
          await db().query(
            "SELECT id,advertiser,creative,position,starts_at,ends_at,amount_usd,payment_status,moderation_status,is_demo FROM placement_orders WHERE ($2 OR advertiser_id=$1::uuid) ORDER BY created_at DESC LIMIT 100",
            [user.role === "admin" ? null : user.sub, user.role === "admin"],
          )
        ).rows,
      });
    }
    if (route === "leaderboard") {
      const id = req.nextUrl.searchParams.get("season") || undefined;
      if (id) z.string().uuid().parse(id);
      return json(await leaderboard(id));
    }
    if (route === "seasons")
      return json({
        seasons: (
          await db().query("SELECT * FROM seasons ORDER BY starts_at DESC")
        ).rows,
      });
    if (route === "feed/queue") {
      const season = await currentSeason();
      const d = await device();
      const identity = await session();
      const category = normalizeCategory(
        req.nextUrl.searchParams.get("category") || "",
      );
      const exclude = z
        .array(z.string().uuid())
        .max(100)
        .parse(
          req.nextUrl.searchParams.get("exclude")?.split(",").filter(Boolean) ||
            [],
        );
      // Warming a deck must not increase exposure. The visible card records its
      // impression separately; rank and paid backing never enter this query.
      const companies = (
        await db().query(
          `WITH candidates AS (SELECT co.id,s.impressions FROM companies co JOIN company_season_stats s ON s.company_id=co.id AND s.season_id=$1 WHERE co.status='approved' AND ($3::text IS NULL OR co.category=$3) AND NOT(co.id=ANY($5::uuid[])) AND NOT EXISTS(SELECT 1 FROM community_backs b WHERE b.company_id=co.id AND b.season_id=$1 AND (b.device_hash=$2 OR ($4::uuid IS NOT NULL AND b.user_id=$4))) AND NOT EXISTS(SELECT 1 FROM skips sk WHERE sk.company_id=co.id AND sk.season_id=$1 AND (sk.device_hash=$2 OR ($4::uuid IS NOT NULL AND sk.user_id=$4)))) SELECT co.id,co.slug,co.name,co.tagline,co.description,co.url,co.category,co.logo_url,co.hero_image_url,co.verification_status,co.is_demo,co.what_it_does,co.target_audience,co.pricing_model,co.pricing_note,co.tags FROM candidates ca JOIN companies co ON co.id=ca.id WHERE ca.impressions<=(SELECT MIN(impressions)+5 FROM candidates) ORDER BY random() LIMIT 6`,
          [
            season.id,
            d,
            category && category !== "All" ? category : null,
            identity?.role === "owner" ? identity.sub : null,
            exclude,
          ],
        )
      ).rows;
      return json({ companies, season });
    }
    if (route === "feed/next") {
      const season = await currentSeason();
      const d = await device();
      const identity = await session();
      const userId = identity?.role === "owner" ? identity.sub : null;
      const category = normalizeCategory(
        req.nextUrl.searchParams.get("category") || "",
      );
      const company = await transaction(async (c) => {
        const candidate = (
          await c.query(
            `WITH candidates AS (SELECT co.id, s.impressions FROM companies co JOIN company_season_stats s ON s.company_id=co.id AND s.season_id=$1 WHERE co.status='approved' AND ($3::text IS NULL OR co.category=$3) AND NOT EXISTS(SELECT 1 FROM community_backs b WHERE b.company_id=co.id AND b.season_id=$1 AND (b.device_hash=$2 OR ($4::uuid IS NOT NULL AND b.user_id=$4))) AND NOT EXISTS(SELECT 1 FROM skips sk WHERE sk.company_id=co.id AND sk.season_id=$1 AND (sk.device_hash=$2 OR ($4::uuid IS NOT NULL AND sk.user_id=$4)))) SELECT co.id,co.slug,co.name,co.tagline,co.description,co.url,co.category,co.logo_url,co.hero_image_url,co.verification_status,co.is_demo,co.what_it_does,co.target_audience,co.pricing_model,co.pricing_note,co.tags FROM candidates ca JOIN companies co ON co.id=ca.id WHERE ca.impressions<=(SELECT MIN(impressions)+5 FROM candidates) ORDER BY random() LIMIT 1`,
            [
              season.id,
              d,
              category && category !== "All" ? category : null,
              userId,
            ],
          )
        ).rows[0];
        if (candidate) {
          const inserted = await c.query(
            "INSERT INTO feed_views(id,company_id,season_id,device_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id",
            [randomUUID(), candidate.id, season.id, d],
          );
          if (inserted.rowCount) {
            await c.query(
              "UPDATE company_season_stats SET impressions=impressions+1 WHERE company_id=$1 AND season_id=$2",
              [candidate.id, season.id],
            );
            await recordEvent(
              c,
              candidate.id,
              season.id,
              "impression",
              d,
              req.nextUrl.searchParams.get("source") || "direct",
            );
          }
        }
        return candidate || null;
      });
      return json({ company, season });
    }
    if (path[0] === "company" && path.length === 2) {
      const company = await companyBySlug(path[1]);
      if (!company) throw new HttpError(404, "Company not found.");
      const d = await device();
      const identity = await session();
      const userId = identity?.role === "owner" ? identity.sub : null;
      const backed = !!(
        await db().query(
          "SELECT 1 FROM community_backs WHERE company_id=$1 AND season_id=$2 AND (device_hash=$3 OR ($4::uuid IS NOT NULL AND user_id=$4))",
          [company.id, company.season.id, d, userId],
        )
      ).rowCount;
      return json({ company, backed });
    }
    if (path[0] === "company" && path[2] === "analytics") {
      const user = await requireUser();
      const id = z.string().uuid().parse(path[1]);
      const owner = (
        await db().query("SELECT owner_id FROM companies WHERE id=$1", [id])
      ).rows[0];
      if (!owner || (owner.owner_id !== user.sub && user.role !== "admin"))
        throw new HttpError(403, "Only verified owners can view analytics.");
      const season = await currentSeason();
      return json({
        stats: (
          await db().query(`SELECT r.* FROM (${rankedSql}) r WHERE id=$2`, [
            season.id,
            id,
          ])
        ).rows[0],
        sources: (
          await db().query(
            "SELECT source,kind,count(*)::integer AS count FROM analytics_events WHERE company_id=$1 AND season_id=$2 GROUP BY source,kind ORDER BY count DESC",
            [id, season.id],
          )
        ).rows,
        history: (
          await db().query(
            `SELECT date_trunc('day',created_at) AS day,kind,count(*)::integer AS count FROM analytics_events WHERE company_id=$1 AND season_id=$2 GROUP BY day,kind ORDER BY day`,
            [id, season.id],
          )
        ).rows,
      });
    }
    if (route === "dashboard") {
      const user = await requireUser();
      return json({
        companies: (
          await db().query(
            "SELECT * FROM companies WHERE owner_id=$1 OR submitted_by=$1 ORDER BY created_at DESC",
            [user.sub],
          )
        ).rows,
        claims: (
          await db().query(
            "SELECT cl.id,cl.method,cl.status,c.name,c.slug FROM claims cl JOIN companies c ON c.id=cl.company_id WHERE user_id=$1 ORDER BY cl.created_at DESC",
            [user.sub],
          )
        ).rows,
      });
    }
    if (route === "placements")
      return json({ placements: await activePlacements() });
    if (route === "placement-availability") {
      return json({
        bookings: (
          await db().query(
            "SELECT position,starts_at,ends_at FROM placement_orders WHERE ends_at>now() AND payment_status='succeeded' AND moderation_status!='rejected'",
          )
        ).rows,
      });
    }
    if (route === "order") {
      const id = z.string().uuid().parse(req.nextUrl.searchParams.get("id"));
      const order = (
        await db().query(
          "SELECT payment_status,amount_usd FROM sponsorships WHERE id=$1 UNION ALL SELECT payment_status,amount_usd FROM placement_orders WHERE id=$1",
          [id],
        )
      ).rows[0];
      if (!order) throw new HttpError(404, "Order not found.");
      return json(order);
    }
    if (route === "admin") {
      await requireAdmin();
      return json({
        companies: (
          await db().query(
            "SELECT id,name,slug,url,tagline,description,logo_url,hero_image_url,category,status,is_demo,verification_status,what_it_does,target_audience,pricing_model,pricing_note,tags FROM companies ORDER BY created_at DESC LIMIT 200",
          )
        ).rows,
        claims: (
          await db().query(
            "SELECT cl.id,cl.method,cl.status,cl.email,c.name,u.email AS requester FROM claims cl JOIN companies c ON c.id=cl.company_id JOIN users u ON u.id=cl.user_id WHERE cl.status='pending'",
          )
        ).rows,
        backs: (
          await db().query(
            "SELECT b.id,b.valid,b.risk_score,b.invalid_reason,b.created_at,c.name FROM community_backs b JOIN companies c ON c.id=b.company_id WHERE b.risk_score>0 ORDER BY b.created_at DESC LIMIT 100",
          )
        ).rows,
        reports: (
          await db().query(
            "SELECT r.*,c.name FROM reports r JOIN companies c ON c.id=r.company_id WHERE r.status='pending'",
          )
        ).rows,
        placements: (
          await db().query(
            "SELECT * FROM placement_orders ORDER BY created_at DESC LIMIT 100",
          )
        ).rows,
        audit: (
          await db().query(
            "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50",
          )
        ).rows,
      });
    }
    throw new HttpError(404, "Endpoint not found.");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, ctx: Context) {
  try {
    const path = (await ctx.params).path;
    const route = path.join("/");
    if (route === "dodo/webhook") {
      if (!process.env.DODO_PAYMENTS_WEBHOOK_KEY)
        throw new HttpError(503, "Webhook is not configured.");
      const body = new TextDecoder().decode(await limitedBody(req, 1000000));
      if (body.length > 1000000) throw new HttpError(413, "Webhook too large.");
      const client = paymentClient();
      let event: PaymentEvent;
      try {
        event = client.webhooks.unwrap(body, {
          headers: {
            "webhook-id": req.headers.get("webhook-id") || "",
            "webhook-signature": req.headers.get("webhook-signature") || "",
            "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
          },
        }) as unknown as PaymentEvent;
      } catch {
        throw new HttpError(401, "Invalid webhook signature.");
      }
      if (
        (
          await db().query("SELECT 1 FROM webhook_events WHERE id=$1", [
            req.headers.get("webhook-id"),
          ])
        ).rowCount
      )
        return json({ received: true });
      // Retrieve authoritative payment data for successful events, validating order amount and currency.
      if (
        [
          "payment.succeeded",
          "refund.succeeded",
          "dispute.opened",
          "dispute.won",
          "dispute.lost",
          "dispute.accepted",
          "dispute.expired",
          "dispute.cancelled",
          "dispute.challenged",
        ].includes(event.type) &&
        event.data.payment_id
      ) {
        const payment = await client.payments.retrieve(event.data.payment_id);
        if (
          event.type === "payment.succeeded" &&
          payment.status !== "succeeded"
        )
          throw new HttpError(400, "Payment is not confirmed.");
        event = normalizePaymentEvent(
          event.type,
          payment as unknown as PaymentEvent["data"],
        );
      }
      await applyPaymentEvent(req.headers.get("webhook-id")!, event);
      return json({ received: true });
    }
    checkOrigin(req);
    await limit(`post:${ip(req)}:${path[0]}`, 120, 60);
    const raw = new TextDecoder().decode(await limitedBody(req, 32000));
    if (raw.length > 32000) throw new HttpError(413, "Request too large.");
    const body = JSON.parse(raw || "{}");
    if (route === "identity") {
      await device();
      return json({ ready: true });
    }
    if (["ads/impression", "ads/viewable"].includes(route))
      return json(
        await adEvent(body, await device(), route === "ads/viewable"),
      );
    if (route === "feed/impression") {
      const input = z
        .object({
          companyId: z.string().uuid(),
          seasonId: z.string().uuid(),
          source: z.string().max(200).optional(),
        })
        .parse(body);
      const season = await currentSeason();
      if (input.seasonId !== season.id)
        throw new HttpError(
          409,
          "A new week has started. Refresh your discovery stack.",
          "SEASON_CHANGED",
        );
      const d = await device();
      await transaction(async (c) => {
        const inserted = await c.query(
          `INSERT INTO feed_views(id,company_id,season_id,device_hash) SELECT $1,co.id,$3,$4 FROM companies co JOIN company_season_stats s ON s.company_id=co.id AND s.season_id=$3 WHERE co.id=$2 AND co.status='approved' ON CONFLICT DO NOTHING RETURNING id`,
          [randomUUID(), input.companyId, season.id, d],
        );
        if (inserted.rowCount) {
          await c.query(
            "UPDATE company_season_stats SET impressions=impressions+1 WHERE company_id=$1 AND season_id=$2",
            [input.companyId, season.id],
          );
          await recordEvent(
            c,
            input.companyId,
            season.id,
            "impression",
            d,
            input.source,
          );
        }
      });
      return json({ recorded: true });
    }
    if (route === "auth/register" || route === "auth/login") {
      await limit(`auth:${ip(req)}`, 10, 60);
      const input = authSchema.parse(body);
      let user;
      if (
        route === "auth/login" &&
        process.env.ADMIN_EMAIL &&
        input.email === process.env.ADMIN_EMAIL.toLowerCase() &&
        process.env.ADMIN_PASSWORD &&
        safeEqual(input.password, process.env.ADMIN_PASSWORD)
      )
        user = { id: "admin", email: input.email, role: "admin" };
      else if (route === "auth/register") {
        if (input.email === process.env.ADMIN_EMAIL?.toLowerCase())
          throw new HttpError(409, "This email is reserved.");
        const existing = await db().query(
          "SELECT 1 FROM users WHERE email=$1",
          [input.email],
        );
        if (existing.rowCount)
          throw new HttpError(
            409,
            "An account with that email already exists.",
          );
        const id = randomUUID();
        await db().query(
          "INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)",
          [id, input.email, passwordHash(input.password)],
        );
        user = { id, email: input.email, role: "owner" };
      } else {
        const record = (
          await db().query("SELECT * FROM users WHERE email=$1", [input.email])
        ).rows[0];
        if (!record || !checkPassword(input.password, record.password_hash))
          throw new HttpError(401, "Email or password is incorrect.");
        user = { id: record.id, email: record.email, role: "owner" };
      }
      (await cookies()).set(
        "backing_session",
        await sign({ sub: user.id, email: user.email, role: user.role }),
        cookieOptions(),
      );
      return json({ user });
    }
    if (route === "auth/logout") {
      (await cookies()).delete("backing_session");
      return json({ ok: true });
    }
    if (route === "back" || route === "skip") {
      const input = backSchema.parse(body);
      const d = await device();
      const identity = await session();
      const userId = identity?.role === "owner" ? identity.sub : null;
      await limit(`${route}:${d}`, 30, 60);
      const season = await currentSeason();
      if (input.seasonId && input.seasonId !== season.id)
        throw new HttpError(
          409,
          "A new week has started. Refresh your discovery stack.",
          "SEASON_CHANGED",
        );
      const assessment =
        route === "back" ? await risk(req, d, input.turnstileToken) : null;
      const result = await transaction(async (c) => {
        const company = (
          await c.query(
            "SELECT id,EXISTS(SELECT 1 FROM feed_views WHERE company_id=$1 AND season_id=$2 AND device_hash=$3) AS seen_in_feed FROM companies WHERE id=$1 AND status='approved'",
            [input.companyId, season.id, d],
          )
        ).rows[0];
        if (!company) throw new HttpError(404, "Company not found.");
        // A rapid swipe can arrive before its exposure request. Count the
        // visible impression in the same transaction, using the same unique
        // key and lock order as feed/impression to avoid double counting.
        if (input.surface === "feed" && !company.seen_in_feed) {
          const exposure = await c.query(
            "INSERT INTO feed_views(id,company_id,season_id,device_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id",
            [randomUUID(), company.id, season.id, d],
          );
          if (exposure.rowCount) {
            await c.query(
              "UPDATE company_season_stats SET impressions=impressions+1 WHERE company_id=$1 AND season_id=$2",
              [company.id, season.id],
            );
            await recordEvent(
              c,
              company.id,
              season.id,
              "impression",
              d,
              input.source,
            );
          }
          company.seen_in_feed = true;
        }
        if (route === "back") {
          const surface =
            input.surface === "feed" && company.seen_in_feed
              ? "feed"
              : "profile";
          const inserted = await c.query(
            "INSERT INTO community_backs(id,company_id,season_id,device_hash,ip_hash,risk_score,valid,user_id,surface) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id",
            [
              randomUUID(),
              company.id,
              season.id,
              d,
              assessment!.ipHash,
              assessment!.score,
              assessment!.valid,
              userId,
              surface,
            ],
          );
          if (!inserted.rowCount)
            throw new HttpError(
              409,
              "You have already backed this company this week.",
            );
          if (assessment!.valid)
            await c.query(
              "UPDATE company_season_stats SET community_points=community_points+1,feed_backs=feed_backs+$3,reached_at=now() WHERE company_id=$1 AND season_id=$2",
              [company.id, season.id, surface === "feed" ? 1 : 0],
            );
          await recordEvent(
            c,
            company.id,
            season.id,
            assessment!.valid ? "back" : "back_held",
            d,
            input.source,
          );
        } else {
          const inserted = await c.query(
            "INSERT INTO skips(company_id,season_id,device_hash,user_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING company_id",
            [company.id, season.id, d, userId],
          );
          if (inserted.rowCount) {
            await c.query(
              "UPDATE company_season_stats SET skips=skips+1 WHERE company_id=$1 AND season_id=$2",
              [company.id, season.id],
            );
            await recordEvent(
              c,
              company.id,
              season.id,
              "skip",
              d,
              input.source,
            );
          }
        }
        const rank = (
          await c.query(
            `SELECT id,total_points,rank FROM (${rankedSql}) r WHERE id=$2`,
            [season.id, company.id],
          )
        ).rows[0];
        return { ...rank, valid: route === "back" ? assessment!.valid : true };
      });
      return json(result);
    }
    if (route === "company") {
      const user = await requireUser();
      await limit(`submission:${user.sub}`, 5, 3600);
      if (user.role === "admin")
        throw new HttpError(400, "Use an owner account to submit.");
      const input = companySchema.parse(body);
      safeUrl(input.url);
      if (input.social_url) safeUrl(input.social_url);
      validateAsset(input.logo_url);
      validateAsset(input.hero_image_url);
      const id = randomUUID();
      const slug =
        input.name
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "company";
      const exists = (
        await db().query("SELECT 1 FROM companies WHERE slug=$1", [slug])
      ).rowCount;
      await db().query(
        "INSERT INTO companies(id,name,slug,url,tagline,description,logo_url,hero_image_url,category,social_url,submitted_by,what_it_does,target_audience,pricing_model,pricing_note,tags) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
        [
          id,
          input.name,
          exists ? `${slug}-${id.slice(0, 6)}` : slug,
          input.url,
          input.tagline,
          input.description,
          input.logo_url,
          input.hero_image_url,
          input.category,
          input.social_url || null,
          user.sub,
          input.what_it_does,
          input.target_audience,
          input.pricing_model,
          input.pricing_note,
          input.tags,
        ],
      );
      return json({ id, submitted: true }, 201);
    }
    if (path[0] === "company" && path[2] === "claim") {
      const user = await requireUser();
      await limit(`claim:${user.sub}`, 10, 3600);
      const input = z
        .object({
          method: z.enum(["dns", "html", "email", "manual"]),
          email: z.string().email().optional(),
        })
        .parse(body);
      return json(
        await startClaim(
          z.string().uuid().parse(path[1]),
          String(user.sub),
          input.method,
          input.email,
        ),
      );
    }
    if (route === "claim/verify") {
      const user = await requireUser();
      return json(
        await verifyClaim(
          String(user.sub),
          z.string().min(40).max(100).parse(body.token),
        ),
      );
    }
    if (route === "sponsorship/checkout") {
      await limit(`checkout:${ip(req)}`, 10, 60);
      return json(await backingCheckout(checkoutSchema.parse(body)));
    }
    if (route === "placements/checkout") {
      await limit(`checkout:${ip(req)}`, 10, 60);
      const user = await requireUser();
      if (user.role === "admin")
        throw new HttpError(
          400,
          "Use an advertiser account to book a placement.",
        );
      const input = placementSchema.parse(body);
      safeUrl(input.destination_url);
      validateAsset(input.logo_url);
      validateAsset(input.hero_image_url);
      return json(await placementCheckout(input, String(user.sub)));
    }
    if (route === "event") {
      const input = z
        .object({
          companyId: z.string().uuid(),
          kind: z.enum(["profile", "share", "outbound"]),
          source: z.string().max(200).default("direct"),
        })
        .parse(body);
      const d = await device();
      const season = await currentSeason();
      await transaction(async (c) => {
        const exists = (
          await c.query(
            "SELECT 1 FROM companies WHERE id=$1 AND status='approved'",
            [input.companyId],
          )
        ).rowCount;
        if (!exists) throw new HttpError(404, "Company not found.");
        await recordEvent(
          c,
          input.companyId,
          season.id,
          input.kind,
          d,
          input.source,
        );
        if (input.kind !== "share")
          await c.query(
            `UPDATE company_season_stats SET ${input.kind === "profile" ? "profile_views=profile_views+1" : "clicks=clicks+1"} WHERE company_id=$1 AND season_id=$2`,
            [input.companyId, season.id],
          );
      });
      return json({ ok: true });
    }
    if (route === "report") {
      const input = z
        .object({
          companyId: z.string().uuid(),
          reason: z.string().trim().min(10).max(1000),
        })
        .parse(body);
      await limit(`report:${ip(req)}`, 5, 3600);
      await db().query(
        "INSERT INTO reports(id,company_id,reason) VALUES($1,$2,$3)",
        [randomUUID(), input.companyId, input.reason],
      );
      return json({ ok: true });
    }
    if (route === "admin/action") {
      const admin = await requireAdmin();
      const activeSeason = await currentSeason();
      const input = z
        .object({
          type: z.enum(["company", "claim", "back", "placement", "report"]),
          id: z.string().uuid(),
          action: z.enum([
            "approve",
            "reject",
            "hide",
            "invalidate",
            "restore",
            "resolve",
          ]),
          reason: z.string().max(1000).default("Moderator review"),
        })
        .parse(body);
      if (input.type === "claim" && input.action === "approve") {
        await approveClaim(input.id, String(admin.email));
        return json({ ok: true });
      }
      await transaction(async (c) => {
        if (input.type === "company") {
          const status = {
            approve: "approved",
            reject: "rejected",
            hide: "hidden",
          }[input.action as "approve" | "reject" | "hide"];
          if (!status) throw new HttpError(400, "Invalid moderation action.");
          await c.query("UPDATE companies SET status=$2 WHERE id=$1", [
            input.id,
            status,
          ]);
          if (status === "approved")
            await c.query(
              "INSERT INTO company_season_stats(company_id,season_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
              [input.id, activeSeason.id],
            );
        } else if (input.type === "back") {
          const b = (
            await c.query(
              "SELECT * FROM community_backs WHERE id=$1 FOR UPDATE",
              [input.id],
            )
          ).rows[0];
          if (!b) throw new HttpError(404, "Back not found.");
          const valid = input.action === "restore";
          if (!["restore", "invalidate"].includes(input.action))
            throw new HttpError(400, "Invalid moderation action.");
          if (b.valid !== valid) {
            await c.query(
              "UPDATE company_season_stats SET community_points=GREATEST(0,community_points+$3),feed_backs=GREATEST(0,feed_backs+$4),reached_at=now() WHERE company_id=$1 AND season_id=$2",
              [
                b.company_id,
                b.season_id,
                valid ? 1 : -1,
                b.surface === "feed" ? (valid ? 1 : -1) : 0,
              ],
            );
            await c.query(
              "UPDATE community_backs SET valid=$2,invalid_reason=$3 WHERE id=$1",
              [b.id, valid, valid ? null : input.reason],
            );
          }
        } else if (input.type === "placement") {
          if (!["approve", "reject"].includes(input.action))
            throw new HttpError(400, "Invalid action.");
          await c.query(
            "UPDATE placement_orders SET moderation_status=$2 WHERE id=$1",
            [input.id, input.action === "approve" ? "approved" : "rejected"],
          );
        } else if (input.type === "claim")
          await c.query("UPDATE claims SET status='rejected' WHERE id=$1", [
            input.id,
          ]);
        else if (input.type === "report")
          await c.query("UPDATE reports SET status='resolved' WHERE id=$1", [
            input.id,
          ]);
        await c.query(
          "INSERT INTO audit_log(actor,action,target_id,details) VALUES($1,$2,$3,$4)",
          [
            admin.email,
            `${input.type}.${input.action}`,
            input.id,
            JSON.stringify({ reason: input.reason }),
          ],
        );
      });
      return json({ ok: true });
    }
    throw new HttpError(404, "Endpoint not found.");
  } catch (error) {
    return errorResponse(error);
  }
}
function validateAsset(value: string) {
  if (value.startsWith("/api/uploads/") && /^[a-z0-9./-]+$/.test(value)) return;
  safeUrl(value);
}
