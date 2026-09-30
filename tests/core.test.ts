import { test } from "node:test";
import assert from "node:assert/strict";
import { weekBounds } from "../src/lib/leaderboard";
import { companySchema, checkoutSchema } from "../src/lib/validation";
import { publicAddress } from "../src/lib/claims";
import { safeUrl } from "../src/lib/security";
import { normalizePaymentEvent } from "../src/lib/payments";
import { checkPassword, passwordHash, sign, verify } from "../src/lib/auth";
import { limitedBody } from "../src/lib/http";
import DodoPayments from "dodopayments";
import { createHmac, randomBytes } from "node:crypto";
process.env.SESSION_SECRET = "test-secret-only-for-unit-testing-32-characters";
test("official Dodo SDK rejects forged, tampered and stale webhook signatures", () => {
  const secret = randomBytes(32);
  const client = new DodoPayments({
    bearerToken: "unit-test-not-a-real-api-key",
    webhookKey: `whsec_${secret.toString("base64")}`,
    environment: "test_mode",
  });
  const body = JSON.stringify({
    type: "payment.succeeded",
    data: { payment_id: "unit-test" },
    timestamp: new Date().toISOString(),
    business_id: "unit-test",
  });
  const id = "unit-webhook";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  const headers = {
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  };
  assert.equal(
    client.webhooks.unwrap(body, { headers }).type,
    "payment.succeeded",
  );
  assert.throws(() => client.webhooks.unwrap(body + " ", { headers }));
  assert.throws(() =>
    client.webhooks.unwrap(body, {
      headers: { ...headers, "webhook-signature": "v1,forged" },
    }),
  );
  assert.throws(() =>
    client.webhooks.unwrap(body, {
      headers: { ...headers, "webhook-timestamp": "1" },
    }),
  );
});
test("seasons reset at Monday 00:00 UTC, including year rollover", () => {
  assert.deepEqual(weekBounds(new Date("2026-09-30T12:30:00+05:00")), {
    starts_at: "2026-09-28T00:00:00.000Z",
    ends_at: "2026-10-05T00:00:00.000Z",
  });
  assert.equal(
    weekBounds(new Date("2027-01-01T01:00:00Z")).starts_at,
    "2026-12-28T00:00:00.000Z",
  );
  assert.equal(
    weekBounds(new Date("2026-10-05T00:00:00Z")).starts_at,
    "2026-10-05T00:00:00.000Z",
  );
});
test("custom sponsorship amounts must be positive whole dollars", () => {
  for (const amount of [0, -1, 1.5, 100001])
    assert.equal(
      checkoutSchema.safeParse({
        companyId: "123e4567-e89b-12d3-a456-426614174000",
        email: "a@b.com",
        amount,
      }).success,
      false,
    );
});
test("taglines and required image/category fields enforce the PRD", () => {
  const valid = {
    name: "Example",
    url: "https://example.com",
    tagline: "A good company.",
    logo_url: "https://example.com/logo.png",
    hero_image_url: "https://example.com/hero.png",
    category: "SaaS",
  };
  assert.ok(companySchema.safeParse(valid).success);
  assert.equal(
    companySchema.safeParse({ ...valid, tagline: "x".repeat(81) }).success,
    false,
  );
  assert.equal(
    companySchema.safeParse({ ...valid, logo_url: "" }).success,
    false,
  );
});
test("verification rejects private, loopback, metadata, and reserved IPs", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.2",
    "172.19.1.1",
    "192.168.4.2",
    "169.254.169.254",
    "100.64.0.1",
    "198.18.0.1",
    "224.1.1.1",
    "255.255.255.255",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "fd12::1",
  ])
    assert.equal(publicAddress(address), false, address);
  assert.ok(publicAddress("8.8.8.8"));
  assert.ok(publicAddress("2606:4700:4700::1111"));
});
test("company URLs cannot contain scripts, credentials, private hosts or custom ports", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://example.com:8443",
    "https://user:pass@example.com",
  ])
    assert.throws(() => safeUrl(url));
  assert.equal(safeUrl("https://example.com").hostname, "example.com");
});
test("password hashes are salted and verify without retaining plaintext", () => {
  const a = passwordHash("secure-test-password");
  const b = passwordHash("secure-test-password");
  assert.notEqual(a, b);
  assert.ok(checkPassword("secure-test-password", a));
  assert.equal(checkPassword("wrong", a), false);
});
test("signed anonymous identity rejects tampered and expired tokens", async () => {
  const token = await sign({ device: "demo-device" });
  assert.equal((await verify(token))?.device, "demo-device");
  assert.equal(await verify(`${token.slice(0, -8)}tampered`), null);
  assert.equal(await verify(await sign({ device: "expired" }, "-1s")), null);
});
test("authoritative refunds and disputes override delayed success events", () => {
  assert.equal(
    normalizePaymentEvent("payment.succeeded", { refund_status: "partial" })
      .type,
    "refund.succeeded",
  );
  assert.equal(
    normalizePaymentEvent("payment.succeeded", {
      disputes: [{ dispute_status: "dispute_opened" }],
    }).type,
    "dispute.opened",
  );
  assert.equal(
    normalizePaymentEvent("dispute.opened", {
      disputes: [{ dispute_status: "dispute_won" }],
    }).type,
    "dispute.won",
  );
});
test("body size enforcement counts bytes even without content-length", async () => {
  const request = new Request("http://localhost/test", {
    method: "POST",
    body: "x".repeat(500),
  });
  await assert.rejects(limitedBody(request, 100));
  assert.equal(
    new TextDecoder().decode(
      await limitedBody(
        new Request("http://localhost/test", { method: "POST", body: "small" }),
        100,
      ),
    ),
    "small",
  );
});
