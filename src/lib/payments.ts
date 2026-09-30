import DodoPayments from "dodopayments";
import { randomUUID } from "node:crypto";
import { db, transaction } from "./db";
import { currentSeason } from "./leaderboard";
import { HttpError } from "./auth";
import type { z } from "zod";
import { checkoutSchema, placementSchema } from "./validation";

export function paymentClient() {
  if (!process.env.DODO_PAYMENTS_API_KEY)
    throw new HttpError(
      503,
      "Sponsorship payments are opening soon. Dodo Payments is not configured yet.",
    );
  return new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
    environment:
      process.env.APP_ENV === "production" &&
      process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
        ? "live_mode"
        : "test_mode",
  });
}
async function validateProduct(
  client: DodoPayments,
  id: string,
  amount: number,
) {
  const product = await client.products.retrieve(id);
  const price = product.price;
  if (
    price.type !== "one_time_price" ||
    price.currency !== "USD" ||
    !price.pay_what_you_want ||
    price.tax_inclusive ||
    price.purchasing_power_parity ||
    (price.discount_bps || price.discount || 0) > 0
  )
    throw new HttpError(
      503,
      "The sponsorship product needs one-time USD, pay-what-you-want, tax-exclusive pricing with no discounts.",
    );
  if (price.price > amount * 100)
    throw new HttpError(
      400,
      "This amount is below the configured product minimum.",
    );
}
function checkoutConfig(product: string | undefined) {
  if (!product || !process.env.APP_URL)
    throw new HttpError(
      503,
      "Checkout is awaiting payment product and website URL configuration.",
    );
  return { product, base: process.env.APP_URL };
}
export async function backingCheckout(input: z.infer<typeof checkoutSchema>) {
  const client = paymentClient();
  const { product, base } = checkoutConfig(process.env.DODO_BACKING_PRODUCT_ID);
  const company = (
    await db().query(
      "SELECT * FROM companies WHERE id=$1 AND status='approved'",
      [input.companyId],
    )
  ).rows[0];
  if (!company) throw new HttpError(404, "Company not found.");
  await validateProduct(client, product, input.amount);
  const season = await currentSeason();
  const id = randomUUID();
  await db().query(
    "INSERT INTO sponsorships(id,company_id,season_id,amount_usd,email) VALUES($1,$2,$3,$4,$5)",
    [id, company.id, season.id, input.amount, input.email],
  );
  try {
    const session = await client.checkoutSessions.create({
      product_cart: [
        { product_id: product, quantity: 1, amount: input.amount * 100 },
      ],
      billing_currency: "USD",
      customer: { email: input.email },
      metadata: {
        backing_order_id: id,
        kind: "backing",
        app_env: process.env.APP_ENV || "staging",
      },
      return_url: `${base}/sponsor/${company.slug}?order=${id}`,
      cancel_url: `${base}/sponsor/${company.slug}`,
      feature_flags: {
        allow_currency_selection: false,
        allow_discount_code: false,
      },
    });
    await db().query("UPDATE sponsorships SET checkout_id=$2 WHERE id=$1", [
      id,
      session.session_id,
    ]);
    return { checkoutUrl: session.checkout_url, orderId: id };
  } catch (error) {
    await db().query(
      "UPDATE sponsorships SET payment_status='checkout_failed' WHERE id=$1",
      [id],
    );
    throw error;
  }
}
export async function placementCheckout(
  input: z.infer<typeof placementSchema>,
  advertiserId: string,
) {
  const client = paymentClient();
  const { product, base } = checkoutConfig(
    process.env.DODO_PLACEMENT_PRODUCT_ID,
  );
  const start = new Date(`${input.date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + input.days * 86400000);
  if (start.getTime() < new Date().setUTCHours(0, 0, 0, 0))
    throw new HttpError(400, "Choose today or a future date.");
  const amount =
    { top: 49, bottom: 29, both: 69, deck: 49 }[input.position] * input.days;
  await validateProduct(client, product, amount);
  const id = randomUUID();
  await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(932103)");
    const overlap = await c.query(
      `SELECT 1 FROM placement_orders WHERE starts_at<$2 AND ends_at>$1 AND (position=$3 OR (position='both' AND $3 IN ('top','bottom','both')) OR ($3='both' AND position IN ('top','bottom','both'))) AND (payment_status='succeeded' OR (payment_status='pending' AND created_at>now()-interval '30 minutes')) AND moderation_status!='rejected'`,
      [start, end, input.position],
    );
    if (overlap.rowCount)
      throw new HttpError(
        409,
        "That placement is already booked. Please choose another date.",
      );
    await c.query(
      "INSERT INTO placement_orders(id,advertiser,creative,destination_url,position,starts_at,ends_at,amount_usd,email,advertiser_id,logo_url,hero_image_url,description,cta_label) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
      [
        id,
        input.advertiser,
        input.creative,
        input.destination_url,
        input.position,
        start,
        end,
        amount,
        input.email,
        advertiserId,
        input.logo_url,
        input.hero_image_url,
        input.description,
        input.cta_label,
      ],
    );
  });
  try {
    const checkout = await client.checkoutSessions.create({
      product_cart: [
        { product_id: product, quantity: 1, amount: amount * 100 },
      ],
      billing_currency: "USD",
      customer: { email: input.email },
      metadata: {
        backing_order_id: id,
        kind: "placement",
        app_env: process.env.APP_ENV || "staging",
      },
      return_url: `${base}/campaigns?order=${id}`,
      feature_flags: {
        allow_currency_selection: false,
        allow_discount_code: false,
      },
    });
    await db().query("UPDATE placement_orders SET checkout_id=$2 WHERE id=$1", [
      id,
      checkout.session_id,
    ]);
    return { checkoutUrl: checkout.checkout_url, orderId: id };
  } catch (error) {
    await db().query(
      "UPDATE placement_orders SET payment_status='checkout_failed' WHERE id=$1",
      [id],
    );
    throw error;
  }
}
export type PaymentEvent = {
  type: string;
  data: {
    payment_id?: string;
    metadata?: Record<string, string>;
    currency?: string;
    total_amount?: number;
    tax?: number | null;
    status?: string;
    refund_status?: string | null;
    checkout_session_id?: string | null;
    product_cart?: { product_id: string; quantity: number }[] | null;
    disputes?: { dispute_status: string }[];
    [key: string]: unknown;
  };
};
export function normalizePaymentEvent(
  type: string,
  data: PaymentEvent["data"],
): PaymentEvent {
  if (data.refund_status) return { type: "refund.succeeded", data };
  const disputes = data.disputes || [];
  if (
    disputes.some((d) =>
      ["dispute_lost", "dispute_expired", "dispute_accepted"].includes(
        d.dispute_status,
      ),
    )
  )
    return { type: "dispute.lost", data };
  if (
    disputes.some((d) =>
      ["dispute_opened", "dispute_challenged"].includes(d.dispute_status),
    )
  )
    return { type: "dispute.opened", data };
  if (type.startsWith("dispute.") && disputes.length)
    return { type: "dispute.won", data };
  return { type, data };
}
export async function applyPaymentEvent(eventId: string, event: PaymentEvent) {
  const paymentId = event.data.payment_id;
  if (!paymentId) return;
  const orderId = event.data.metadata?.backing_order_id;
  const kind = event.data.metadata?.kind;
  const active = await currentSeason();
  await transaction(async (c) => {
    const dedupe = await c.query(
      "INSERT INTO webhook_events(id,type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id",
      [eventId, event.type],
    );
    if (!dedupe.rowCount) return;
    let order =
      orderId && /^[0-9a-f-]{36}$/i.test(orderId)
        ? (
            await c.query(
              `SELECT * FROM ${kind === "placement" ? "placement_orders" : "sponsorships"} WHERE id=$1 FOR UPDATE`,
              [orderId],
            )
          ).rows[0]
        : null;
    let table = kind === "placement" ? "placement_orders" : "sponsorships";
    if (!order) {
      order = (
        await c.query(
          "SELECT * FROM sponsorships WHERE dodo_payment_id=$1 FOR UPDATE",
          [paymentId],
        )
      ).rows[0];
      table = "sponsorships";
    }
    if (!order) {
      order = (
        await c.query(
          "SELECT * FROM placement_orders WHERE dodo_payment_id=$1 FOR UPDATE",
          [paymentId],
        )
      ).rows[0];
      table = "placement_orders";
    }
    if (!order) return;
    if (order.dodo_payment_id && order.dodo_payment_id !== paymentId)
      throw new HttpError(400, "Payment ID mismatch.");
    if (event.type === "payment.succeeded") {
      if (
        order.payment_status === "succeeded" ||
        ["refunded", "disputed", "dispute_lost"].includes(order.payment_status)
      )
        return;
      if (
        event.data.currency !== "USD" ||
        (event.data.total_amount || 0) - (event.data.tax || 0) !==
          order.amount_usd * 100
      )
        throw new HttpError(
          400,
          "Payment amount does not match the sponsorship order.",
        );
      if (event.data.metadata?.app_env !== process.env.APP_ENV)
        throw new HttpError(400, "Payment environment mismatch.");
      if (
        order.checkout_id &&
        event.data.checkout_session_id !== order.checkout_id
      )
        throw new HttpError(400, "Checkout session mismatch.");
      const expectedProduct =
        table === "sponsorships"
          ? process.env.DODO_BACKING_PRODUCT_ID
          : process.env.DODO_PLACEMENT_PRODUCT_ID;
      if (
        expectedProduct &&
        !event.data.product_cart?.some(
          (p) => p.product_id === expectedProduct && p.quantity === 1,
        )
      )
        throw new HttpError(400, "Payment product mismatch.");
      if (table === "sponsorships") {
        await c.query(
          "INSERT INTO company_season_stats(company_id,season_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [order.company_id, active.id],
        );
        await c.query(
          "UPDATE company_season_stats SET sponsored_points=sponsored_points+$3,reached_at=now() WHERE company_id=$1 AND season_id=$2",
          [order.company_id, active.id, order.amount_usd],
        );
        await c.query(
          "UPDATE sponsorships SET payment_status='succeeded',dodo_payment_id=$2,credited_season_id=$3,paid_at=now() WHERE id=$1",
          [order.id, paymentId, active.id],
        );
      } else {
        await c.query("SELECT pg_advisory_xact_lock(932103)");
        const conflict = (
          await c.query(
            "SELECT 1 FROM placement_orders WHERE id!=$1 AND starts_at<$3 AND ends_at>$2 AND (position=$4 OR (position='both' AND $4 IN ('top','bottom','both')) OR ($4='both' AND position IN ('top','bottom','both'))) AND payment_status='succeeded' AND moderation_status!='rejected'",
            [order.id, order.starts_at, order.ends_at, order.position],
          )
        ).rowCount;
        await c.query(
          "UPDATE placement_orders SET payment_status='succeeded',dodo_payment_id=$2,moderation_status=$3,paid_at=now() WHERE id=$1",
          [order.id, paymentId, conflict ? "conflict" : "pending"],
        );
      }
    } else if (
      event.type === "payment.failed" &&
      order.payment_status === "pending"
    )
      await c.query(
        `UPDATE ${table} SET payment_status='failed',dodo_payment_id=$2 WHERE id=$1`,
        [order.id, paymentId],
      );
    else if (
      ["refund.succeeded", "dispute.opened", "dispute.lost"].includes(
        event.type,
      )
    ) {
      if (order.payment_status === "succeeded" && table === "sponsorships")
        await c.query(
          "UPDATE company_season_stats SET sponsored_points=GREATEST(0,sponsored_points-$3),reached_at=now() WHERE company_id=$1 AND season_id=$2",
          [order.company_id, order.credited_season_id, order.amount_usd],
        );
      if (order.payment_status === "refunded") return;
      await c.query(
        `UPDATE ${table} SET payment_status=$2,dodo_payment_id=$3 WHERE id=$1`,
        [
          order.id,
          event.type === "refund.succeeded"
            ? "refunded"
            : event.type === "dispute.lost"
              ? "dispute_lost"
              : "disputed",
          paymentId,
        ],
      );
    } else if (
      event.type === "dispute.won" &&
      order.payment_status === "disputed"
    ) {
      if (table === "sponsorships" && order.credited_season_id)
        await c.query(
          "UPDATE company_season_stats SET sponsored_points=sponsored_points+$3,reached_at=now() WHERE company_id=$1 AND season_id=$2",
          [order.company_id, order.credited_season_id, order.amount_usd],
        );
      await c.query(`UPDATE ${table} SET payment_status=$2 WHERE id=$1`, [
        order.id,
        order.paid_at ? "succeeded" : "pending",
      ]);
    }
  });
}
