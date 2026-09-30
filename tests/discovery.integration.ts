import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { catalog } from "../src/lib/discovery";
import {
  adEvent,
  adClick,
  campaignReport,
  activePlacements,
} from "../src/lib/advertising";
import { applyPaymentEvent } from "../src/lib/payments";
if (process.env.APP_ENV !== "staging")
  throw new Error("Integration tests require staging");
const users: string[] = [],
  orders: string[] = [],
  companies: string[] = [],
  events: string[] = [];
after(async () => {
  for (const id of orders)
    await db().query("DELETE FROM placement_orders WHERE id=$1", [id]);
  for (const id of users)
    await db().query("DELETE FROM users WHERE id=$1", [id]);
  for (const id of companies) {
    await db().query("DELETE FROM company_season_stats WHERE company_id=$1", [
      id,
    ]);
    await db().query("DELETE FROM companies WHERE id=$1", [id]);
  }
  for (const id of events)
    await db().query("DELETE FROM webhook_events WHERE id=$1", [id]);
  await db().end();
});
test("catalog combines literal search, tags, pricing, category and approved-only shortlists", async () => {
  const id = randomUUID(),
    hidden = randomUUID(),
    name = `Catalog-${randomUUID()}`;
  companies.push(id, hidden);
  for (const [company, status] of [
    [id, "approved"],
    [hidden, "hidden"],
  ])
    await db().query(
      "INSERT INTO companies(id,name,slug,url,tagline,logo_url,hero_image_url,category,status,what_it_does,target_audience,pricing_model,tags) VALUES($1,$2,$4,'https://example.com','Search fixture','/api/demo-asset?kind=logo','/api/demo-asset?kind=hero','AI Agents & Infrastructure',$3,'Search documents','Researchers','free',ARRAY['search','open source'])",
      [company, name, status, company],
    );
  assert.equal(
    (
      await catalog(
        new URLSearchParams({
          q: name,
          category: "AI Agents & Infrastructure",
          pricing: "free",
          tag: "search",
        }),
      )
    ).total,
    1,
  );
  assert.equal(
    (await catalog(new URLSearchParams({ q: name, tag: "invoicing" }))).total,
    0,
  );
  assert.equal(
    (await catalog(new URLSearchParams({ ids: `${hidden},${id}` })))
      .companies[0].id,
    id,
  );
  assert.equal((await catalog(new URLSearchParams({ q: "%_" }))).total, 0);
  assert.equal((await catalog(new URLSearchParams({ ids: "" }))).total, 0);
});
test("campaign metrics deduplicate clicks, validate dwell and identity, enforce private access and remain separate from scores", async () => {
  const owner = randomUUID(),
    other = randomUUID(),
    order = randomUUID();
  users.push(owner, other);
  orders.push(order);
  for (const id of users)
    await db().query(
      "INSERT INTO users(id,email,password_hash) VALUES($1,$2,'integration-only')",
      [id, `${id}@example.com`],
    );
  await db().query(
    "INSERT INTO placement_orders(id,advertiser,creative,destination_url,position,starts_at,ends_at,amount_usd,email,advertiser_id,payment_status,moderation_status,is_demo) VALUES($1,'Integration sponsor','Private reporting fixture','https://example.com/path?existing=1','deck',now()-interval '1 day',now()+interval '1 day',49,'fixture@example.com',$2,'succeeded','approved',true)",
    [order, owner],
  );
  const sentinel = randomUUID();
  companies.push(sentinel);
  await db().query(
    "INSERT INTO companies(id,name,slug,url,tagline,logo_url,hero_image_url,category,status) VALUES($1,'Score sentinel',$2,'https://example.com','Fixture','/api/demo-asset?kind=logo','/api/demo-asset?kind=hero','SaaS','hidden')",
    [sentinel, `sentinel-${sentinel}`],
  );
  const season = (
    await db().query(
      "SELECT id FROM seasons WHERE status='active' ORDER BY starts_at DESC LIMIT 1",
    )
  ).rows[0].id;
  await db().query(
    "INSERT INTO company_season_stats(company_id,season_id,community_points) VALUES($1,$2,3)",
    [sentinel, season],
  );
  const score = async () =>
    (
      await db().query(
        "SELECT total_points FROM company_season_stats WHERE company_id=$1",
        [sentinel],
      )
    ).rows[0].total;
  const before = await score();
  const exposures = [randomUUID(), randomUUID(), randomUUID()];
  const body = (n: number) => ({
    exposureId: exposures[n],
    placementId: order,
    surface: "deck",
    category: "AI Agents & Infrastructure",
    source: "test",
  });
  await adEvent(body(0), "browser-a");
  await adEvent(body(0), "browser-a");
  await assert.rejects(() => adEvent(body(0), "browser-b"));
  await db().query(
    "UPDATE ad_exposures SET created_at=now()+interval '1 minute' WHERE id=$1",
    [exposures[0]],
  );
  await assert.rejects(() => adEvent(body(0), "browser-a", true));
  await adEvent(body(1), "browser-a");
  await adEvent(body(2), "browser-b");
  await db().query(
    "UPDATE ad_exposures SET created_at=now()-interval '2 seconds' WHERE placement_id=$1",
    [order],
  );
  await adEvent(body(0), "browser-a", true);
  await adEvent(body(1), "browser-a", true);
  for (const n of [0, 0, 1, 2]) {
    const url = new URL(
      await adClick(
        new URLSearchParams({
          exposure: exposures[n],
          placement: order,
          surface: "deck",
          category: "AI Agents & Infrastructure",
          source: "test",
        }),
        n === 2 ? "browser-b" : "browser-a",
      ),
    );
    assert.equal(url.searchParams.get("existing"), "1");
    assert.equal(url.searchParams.get("utm_campaign"), order);
    assert.equal(url.searchParams.get("utm_medium"), "sponsored");
  }
  await assert.rejects(() => campaignReport(order, other, false));
  assert.deepEqual((await campaignReport(order, owner, false)).stats, {
    served: 3,
    viewable: 2,
    audience: 2,
    outbound_visits: 3,
    unique_clicks: 2,
  });
  assert.equal(await score(), before);
  await db().query(
    "UPDATE placement_orders SET payment_status='refunded' WHERE id=$1",
    [order],
  );
  await assert.rejects(() =>
    adEvent({ ...body(0), exposureId: randomUUID() }, "browser-a"),
  );
});
test("Dodo placement confirmation requires moderation; refund and dispute remove paid inventory without affecting company points", async () => {
  const order = randomUUID();
  orders.push(order);
  const sentinel = randomUUID();
  companies.push(sentinel);
  await db().query(
    "INSERT INTO companies(id,name,slug,url,tagline,logo_url,hero_image_url,category,status) VALUES($1,'Score sentinel',$2,'https://example.com','Fixture','/api/demo-asset?kind=logo','/api/demo-asset?kind=hero','SaaS','hidden')",
    [sentinel, `sentinel-${sentinel}`],
  );
  const season = (
    await db().query(
      "SELECT id FROM seasons WHERE status='active' ORDER BY starts_at DESC LIMIT 1",
    )
  ).rows[0].id;
  await db().query(
    "INSERT INTO company_season_stats(company_id,season_id,community_points) VALUES($1,$2,3)",
    [sentinel, season],
  );
  const score = async () =>
    (
      await db().query(
        "SELECT total_points FROM company_season_stats WHERE company_id=$1",
        [sentinel],
      )
    ).rows[0].total;
  const before = await score();
  await db().query(
    "INSERT INTO placement_orders(id,advertiser,creative,destination_url,position,starts_at,ends_at,amount_usd,email) VALUES($1,'Dodo integration','Payment state fixture','https://example.com','top',now()-interval '1 day',now()+interval '1 day',49,'fixture@example.com')",
    [order],
  );
  const data = {
    payment_id: `fixture-${randomUUID()}`,
    currency: "USD",
    total_amount: 4900,
    tax: 0,
    metadata: {
      backing_order_id: order,
      kind: "placement",
      app_env: "staging",
    },
    product_cart: process.env.DODO_PLACEMENT_PRODUCT_ID
      ? [{ product_id: process.env.DODO_PLACEMENT_PRODUCT_ID, quantity: 1 }]
      : [],
  };
  const apply = async (type: string) => {
    const event = randomUUID();
    events.push(event);
    await applyPaymentEvent(event, { type, data });
  };
  await apply("payment.succeeded");
  assert.ok(!(await activePlacements()).some((p) => p.id === order));
  await db().query(
    "UPDATE placement_orders SET moderation_status='approved' WHERE id=$1",
    [order],
  );
  assert.ok((await activePlacements()).some((p) => p.id === order));
  await apply("dispute.opened");
  assert.ok(!(await activePlacements()).some((p) => p.id === order));
  await apply("dispute.won");
  assert.ok((await activePlacements()).some((p) => p.id === order));
  await apply("refund.succeeded");
  assert.ok(!(await activePlacements()).some((p) => p.id === order));
  assert.equal(await score(), before);
});
