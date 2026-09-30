import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { currentSeason, leaderboard } from "../src/lib/leaderboard";
import { applyPaymentEvent, type PaymentEvent } from "../src/lib/payments";
if (process.env.APP_ENV !== "staging")
  throw new Error("Integration tests must only run in staging");
const ids: string[] = [];
const orders: string[] = [];
const events: string[] = [];
after(async () => {
  for (const id of ids) {
    await db().query("DELETE FROM sponsorships WHERE company_id=$1", [id]);
    await db().query("DELETE FROM company_season_stats WHERE company_id=$1", [
      id,
    ]);
    await db().query("DELETE FROM companies WHERE id=$1", [id]);
  }
  for (const event of events)
    await db().query("DELETE FROM webhook_events WHERE id=$1", [event]);
  await db().end();
});
async function fixture() {
  const season = await currentSeason();
  const id = randomUUID();
  const order = randomUUID();
  ids.push(id);
  orders.push(order);
  await db().query(
    "INSERT INTO companies(id,name,slug,url,tagline,logo_url,hero_image_url,category,status,is_demo) VALUES($1,'Integration fixture',$2,'https://example.com','Payment integrity fixture','/api/demo-asset?kind=logo','/api/demo-asset?kind=hero','SaaS','approved',true)",
    [id, `test-${id}`],
  );
  await db().query(
    "INSERT INTO company_season_stats(company_id,season_id) VALUES($1,$2)",
    [id, season.id],
  );
  await db().query(
    "INSERT INTO sponsorships(id,company_id,season_id,amount_usd,email) VALUES($1,$2,$3,50,'test@example.com')",
    [order, id, season.id],
  );
  const paymentId = `test-payment-${randomUUID()}`;
  return {
    id,
    order,
    season,
    event: {
      type: "payment.succeeded",
      data: {
        payment_id: paymentId,
        currency: "USD",
        total_amount: 5500,
        tax: 500,
        metadata: {
          backing_order_id: order,
          kind: "backing",
          app_env: "staging",
        },
      },
    } as PaymentEvent,
  };
}
async function apply(
  event: PaymentEvent,
  eventId = `test-event-${randomUUID()}`,
) {
  events.push(eventId);
  await applyPaymentEvent(eventId, event);
  return eventId;
}
async function points(id: string, season: string) {
  return (
    await db().query(
      "SELECT total_points,sponsored_points FROM company_season_stats WHERE company_id=$1 AND season_id=$2",
      [id, season],
    )
  ).rows[0];
}
test("confirmed payment counts pre-tax dollars once, even with duplicate or concurrent webhooks", async () => {
  const f = await fixture();
  assert.equal((await points(f.id, f.season.id)).total_points, 0);
  const eventId = await apply(f.event);
  await Promise.all([apply(f.event, eventId), apply(f.event), apply(f.event)]);
  assert.deepEqual(await points(f.id, f.season.id), {
    total_points: 50,
    sponsored_points: 50,
  });
  const board = await leaderboard();
  const entry = board.companies.find((c) => c.id === f.id)!;
  assert.equal(
    entry.total_points,
    entry.community_points + entry.sponsored_points,
  );
});
test("incorrect amount or currency rolls back payment and webhook event", async () => {
  const f = await fixture();
  await assert.rejects(
    apply({ ...f.event, data: { ...f.event.data, total_amount: 100 } }),
  );
  await assert.rejects(
    apply({ ...f.event, data: { ...f.event.data, currency: "EUR" } }),
  );
  assert.equal((await points(f.id, f.season.id)).total_points, 0);
  await apply(f.event);
  assert.equal((await points(f.id, f.season.id)).total_points, 50);
});
test("refund reverses backing once and late success cannot re-credit it", async () => {
  const f = await fixture();
  await apply(f.event);
  await apply({
    type: "refund.succeeded",
    data: { payment_id: f.event.data.payment_id },
  });
  await apply({
    type: "refund.succeeded",
    data: { payment_id: f.event.data.payment_id },
  });
  await apply(f.event);
  assert.equal((await points(f.id, f.season.id)).total_points, 0);
});
test("dispute withholding and restoration preserve the original credit exactly once", async () => {
  const f = await fixture();
  await apply(f.event);
  await apply({
    type: "dispute.opened",
    data: { payment_id: f.event.data.payment_id },
  });
  assert.equal((await points(f.id, f.season.id)).total_points, 0);
  await apply({
    type: "dispute.won",
    data: { payment_id: f.event.data.payment_id },
  });
  await apply({
    type: "dispute.won",
    data: { payment_id: f.event.data.payment_id },
  });
  assert.equal((await points(f.id, f.season.id)).total_points, 50);
});
test("checkout season is not trusted for payments confirmed in a later season", async () => {
  const f = await fixture();
  const previous = (
    await db().query(
      "INSERT INTO seasons(id,starts_at,ends_at,status) VALUES($1,$2::timestamptz-interval '7 days',$2,'archived') ON CONFLICT(starts_at) DO UPDATE SET status='archived' RETURNING id",
      [randomUUID(), f.season.starts_at],
    )
  ).rows[0];
  await db().query("UPDATE sponsorships SET season_id=$2 WHERE id=$1", [
    f.order,
    previous.id,
  ]);
  await apply(f.event);
  assert.equal((await points(f.id, f.season.id)).total_points, 50);
  const row = (
    await db().query(
      "SELECT credited_season_id FROM sponsorships WHERE id=$1",
      [f.order],
    )
  ).rows[0];
  assert.equal(row.credited_season_id, f.season.id);
});
