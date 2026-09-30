import { test, expect } from "@playwright/test";
import { readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
const settings = Object.fromEntries(
  readFileSync(".env.staging", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (settings.APP_ENV !== "staging")
  throw new Error("Browser tests require the staging environment.");
process.env.DATABASE_URL = settings.DATABASE_URL;
const fixtures: string[] = [];
const campaignFixtures: string[] = [];
const uploadedFiles: string[] = [];
const accountEmails: string[] = [];
test("public pages have no automated accessibility violations", async ({
  page,
}) => {
  for (const path of ["/", "/company/orbit", "/rules"]) {
    await page.goto(path);
    if (path === "/")
      await page.locator(".active-card .card-company h2").waitFor();
    if (path === "/company/orbit")
      await page.locator(".profile-score").waitFor();
    await expect(page).toHaveTitle(/Backing/);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
test.beforeAll(async ({ request }) => {
  expect((await (await request.get("/api/health")).json()).environment).toBe(
    "staging",
  );
});
test.afterAll(async () => {
  for (const id of fixtures) {
    for (const table of [
      "claims",
      "analytics_events",
      "feed_views",
      "community_backs",
      "skips",
      "sponsorships",
      "reports",
      "company_season_stats",
    ])
      await db().query(`DELETE FROM ${table} WHERE company_id=$1`, [id]);
    await db().query("DELETE FROM companies WHERE id=$1", [id]);
  }
  for (const id of campaignFixtures)
    await db().query("DELETE FROM placement_orders WHERE id=$1", [id]);
  for (const email of accountEmails)
    await db().query("DELETE FROM users WHERE email=$1", [email]);
  for (const name of uploadedFiles)
    unlinkSync(resolve(settings.UPLOAD_DIR || "data/uploads", name));
  await db().end();
});

test("the fair feed prioritizes low exposure even when another company ranks higher", async ({
  request,
}) => {
  const { season } = await (await request.get("/api/leaderboard")).json();
  const category = `Fairness fixture ${randomUUID()}`;
  const high = randomUUID();
  const low = randomUUID();
  fixtures.push(high, low);
  for (const id of [high, low])
    await db().query(
      "INSERT INTO companies(id,name,slug,url,tagline,logo_url,hero_image_url,category,status,is_demo) VALUES($1,'Fairness fixture',$2,'https://example.com','Staging feed fairness test','/api/demo-asset?kind=logo','/api/demo-asset?kind=hero',$3,'approved',true)",
      [id, `fixture-${id}`, category],
    );
  await db().query(
    "INSERT INTO company_season_stats(company_id,season_id,community_points,impressions) VALUES($1,$3,1000,90),($2,$3,0,0)",
    [high, low, season.id],
  );
  await db().query(
    "INSERT INTO community_backs(id,company_id,season_id,device_hash,ip_hash,risk_score,valid) SELECT gen_random_uuid(),$1,$2,'fixture-'||n,'fixture',0,true FROM generate_series(1,1000) n",
    [high, season.id],
  );
  await db().query(
    "INSERT INTO feed_views(id,company_id,season_id,device_hash) SELECT gen_random_uuid(),$1,$2,'fixture-'||n FROM generate_series(1,90) n",
    [high, season.id],
  );
  const response = await request.get(
    `/api/feed/next?category=${encodeURIComponent(category)}`,
  );
  expect(response.status()).toBe(200);
  const { company } = await response.json();
  expect(company.id).toBe(low);
  expect(company.rank).toBeUndefined();
  await request.post("/api/skip", { data: { companyId: low } });
  expect(
    (
      await (
        await request.get(
          `/api/feed/next?category=${encodeURIComponent(category)}`,
        )
      ).json()
    ).company.id,
  ).toBe(high);
});
test("first interaction is anonymous; feed hides scores and duplicate backs cannot count", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".active-card .card-company h2")).toBeVisible();
  const next = await page.request.get("/api/feed/next");
  const { company } = await next.json();
  expect(company.rank).toBeUndefined();
  expect(company.total_points).toBeUndefined();
  const before = (
    await (await page.request.get(`/api/company/${company.slug}`)).json()
  ).company.community_points;
  const response = await page.request.post("/api/back", {
    data: { companyId: company.id },
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).valid).toBe(true);
  expect(
    (
      await page.request.post("/api/back", { data: { companyId: company.id } })
    ).status(),
  ).toBe(409);
  const after = (
    await (await page.request.get(`/api/company/${company.slug}`)).json()
  ).company.community_points;
  expect(after).toBe(before + 1);
  expect((await page.request.get("/api/auth/session")).ok()).toBe(true);
  expect(
    (await (await page.request.get("/api/auth/session")).json()).user,
  ).toBeNull();
});
test("keyboard backing and skipping work, with no registration", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".active-card .card-company h2")).toBeVisible();
  const name = await page
    .locator(".active-card .card-company h2")
    .textContent();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status")).toContainText("COMMUNITY BACKING");
  await expect(page.locator(".active-card .card-company h2")).not.toHaveText(
    name!,
  );
  const next = await page
    .locator(".active-card .card-company h2")
    .textContent();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".active-card .card-company h2")).not.toHaveText(
    next!,
  );
});
test("preloading does not count impressions; only a visible card is counted once", async ({
  request,
}) => {
  const response = await request.get("/api/feed/queue");
  const { companies, season } = await response.json();
  expect(companies.length).toBeGreaterThan(1);
  expect(companies[0].rank).toBeUndefined();
  expect(companies[0].total_points).toBeUndefined();
  const ids = companies.map((company: { id: string }) => company.id);
  const totals = async () =>
    (
      await db().query(
        "SELECT company_id,impressions FROM company_season_stats WHERE season_id=$1 AND company_id=ANY($2::uuid[]) ORDER BY company_id",
        [season.id, ids],
      )
    ).rows;
  const before = await totals();
  const warmAgain = await request.get(
    `/api/feed/queue?exclude=${ids.join(",")}`,
  );
  const warmed = (await warmAgain.json()).companies;
  expect(
    warmed.every((company: { id: string }) => !ids.includes(company.id)),
  ).toBe(true);
  expect(await totals()).toEqual(before);
  for (let i = 0; i < 2; i++)
    expect(
      (
        await request.post("/api/feed/impression", {
          data: { companyId: ids[0], seasonId: season.id },
        })
      ).status(),
    ).toBe(200);
  const after = await totals();
  for (const row of before)
    expect(
      after.find((item) => item.company_id === row.company_id).impressions,
    ).toBe(row.impressions + (row.company_id === ids[0] ? 1 : 0));
  const stale = { companyId: ids[0], seasonId: randomUUID() };
  expect(
    (await request.post("/api/feed/impression", { data: stale })).status(),
  ).toBe(409);
  expect((await request.post("/api/back", { data: stale })).status()).toBe(409);
  const score = async () =>
    (
      await db().query(
        "SELECT impressions,feed_backs,community_points FROM company_season_stats WHERE company_id=$1 AND season_id=$2",
        [ids[1], season.id],
      )
    ).rows[0];
  const initial = await score();
  const simultaneous = {
    companyId: ids[1],
    seasonId: season.id,
    surface: "feed",
  };
  const responses = await Promise.all([
    request.post("/api/feed/impression", { data: simultaneous }),
    request.post("/api/back", { data: simultaneous }),
  ]);
  for (const response of responses) expect(response.status()).toBe(200);
  expect(await score()).toEqual({
    impressions: initial.impressions + 1,
    feed_backs: initial.feed_backs + 1,
    community_points: initial.community_points + 1,
  });
});
test("switching category during a slow preload shows the latest selection", async ({
  page,
}) => {
  let activeRequests = 0,
    maxActive = 0;
  await page.route("**/api/feed/queue?**", async (route) => {
    activeRequests++;
    maxActive = Math.max(maxActive, activeRequests);
    if (new URL(route.request().url()).searchParams.get("category") === "All")
      await new Promise((resolve) => setTimeout(resolve, 1200));
    const response = await route.fetch();
    await route.fulfill({ response });
    activeRequests--;
  });
  await page.goto("/");
  await expect.poll(() => activeRequests).toBeGreaterThan(0);
  await page.getByRole("button", { name: "AI Agents", exact: true }).click();
  await expect(page.locator(".active-card .visual-label")).toHaveText(
    "AI Agents & Infrastructure",
  );
  expect(maxActive).toBe(1);
  await page.unrouteAll({ behavior: "wait" });
});
test("the next card appears before a slow Back is saved, with its image already loaded", async ({
  page,
}) => {
  await page.route("**/api/back", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue();
  });
  await page.goto("/");
  const heading = page.locator(".active-card .card-company h2");
  await expect(heading).toBeVisible();
  await expect(page.locator(".queued-card").first()).toBeAttached();
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>(
      '[data-depth="1"] .card-visual img',
    );
    return image?.complete && image.naturalWidth > 0;
  });
  const name = await heading.textContent();
  const started = Date.now();
  await page.getByRole("button", { name: "Back +1" }).click();
  await expect(heading).not.toHaveText(name!, { timeout: 800 });
  expect(Date.now() - started).toBeLessThan(1100);
  expect(
    await page
      .locator(".active-card .card-visual img")
      .evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
  ).toBe(true);
  await expect(page.getByRole("status")).toContainText("Sending your Back");
  await expect(page.getByRole("status")).toContainText("COMMUNITY BACKING", {
    timeout: 15000,
  });
});
test("drag tracks the pointer, snaps back below the threshold, and swipes to the next card", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.locator(".active-card");
  const heading = page.locator(".active-card .card-company h2");
  await expect(heading).toBeVisible();
  const name = await heading.textContent();
  const bounds = (await card.boundingBox())!;
  const x = bounds.x + bounds.width / 2,
    y = bounds.y + Math.min(150, bounds.height / 3);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 45, y + 8, { steps: 5 });
  await expect
    .poll(() =>
      card
        .locator(".stamp-back")
        .evaluate((node) => Number(getComputedStyle(node).opacity)),
    )
    .toBeGreaterThan(0.2);
  await page.waitForTimeout(120);
  await page.mouse.up();
  await expect(heading).toHaveText(name!);
  await expect
    .poll(() =>
      card.evaluate((node) =>
        Math.abs(new DOMMatrix(getComputedStyle(node).transform).m41),
      ),
    )
    .toBeLessThan(1);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 160, y + 12, { steps: 8 });
  await page.mouse.up();
  await expect(heading).not.toHaveText(name!, { timeout: 1000 });
});
test("an unsuccessful Back is disclosed and the card can be restored", async ({
  page,
}) => {
  await page.route("**/api/back", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "The connection is unavailable. Please retry.",
      }),
    }),
  );
  await page.goto("/");
  const heading = page.locator(".active-card .card-company h2");
  await expect(heading).toBeVisible();
  const name = await heading.textContent();
  await page.getByRole("button", { name: "Back +1" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("HASN’T BEEN CONFIRMED");
  await page.getByRole("button", { name: "Return to card" }).click();
  await expect(heading).toHaveText(name!);
  await expect(page.getByRole("status")).toContainText("wasn’t saved");
});
test("leaderboard totals are transparent and profiles expose the breakdown", async ({
  page,
}) => {
  await page.goto("/leaderboard");
  await expect(page.locator(".board-row").first()).toBeVisible();
  await page.locator(".board-row").first().click();
  await expect(page.locator(".score-breakdown")).toContainText(
    "Community backing",
  );
  await expect(page.locator(".score-breakdown")).toContainText(
    "Sponsored backing",
  );
  await expect(page.locator(".profile-score")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download card" }),
  ).toHaveAttribute("href", /format=portrait/);
});
test("responsive card and buttons fit in the first mobile viewport without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".active-card .card-company h2")).toBeVisible();
  const button = page.getByRole("button", { name: "Back +1" });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 360, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    const card = await page.locator(".active-card").boundingBox();
    expect(card!.y + card!.height).toBeLessThan(bounds!.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
});
test("sponsorship cannot invent payment success when Dodo is unconfigured", async ({
  page,
}) => {
  await page.goto("/sponsor/orbit");
  await page.getByLabel("Receipt email").fill("test@example.com");
  await page.getByRole("button", { name: "Sponsor for $50" }).click();
  await expect(page.locator('.alert[role="alert"]')).toContainText(
    "not configured",
  );
});
test("private analytics and moderation require authentication; hostile origins are rejected", async ({
  request,
}) => {
  const board = await (await request.get("/api/leaderboard")).json();
  expect(
    (
      await request.get(`/api/company/${board.companies[0].id}/analytics`)
    ).status(),
  ).toBe(401);
  expect((await request.get("/api/admin")).status()).toBe(401);
  expect(
    (
      await request.post("/api/back", {
        headers: { Origin: "https://malicious.example" },
        data: { companyId: board.companies[0].id },
      })
    ).status(),
  ).toBe(403);
});
test("owner submission, moderation, claim, and analytics work together", async ({
  page,
  playwright,
}) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "test-strong-password-123";
  const registration = await page.request.post("/api/auth/register", {
    data: { email, password },
  });
  expect(registration.status()).toBe(200);
  accountEmails.push(email);
  const png = await sharp({
    create: { width: 96, height: 96, channels: 4, background: "#bfea94" },
  })
    .png()
    .toBuffer();
  await page.goto("/submit");
  const uploadResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/upload") &&
      response.request().method() === "POST",
  );
  await page
    .getByLabel("Upload company logo", { exact: true })
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
  const upload = await uploadResponse;
  expect(upload.status()).toBe(200);
  const { url: imageUrl } = await upload.json();
  await expect(page.getByLabel("Company logo", { exact: true })).toHaveValue(
    imageUrl,
  );
  const preview = page.getByAltText("Company logo preview");
  await expect(preview).toBeVisible();
  await expect
    .poll(() =>
      preview.evaluate(
        (image: HTMLImageElement) =>
          image.complete && image.naturalWidth === 96,
      ),
    )
    .toBe(true);
  for (const [name, mimeType, buffer] of [
    [
      "malformed.png",
      "image/png",
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ],
    [
      "unsafe.svg",
      "image/svg+xml",
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
    ],
    ["mislabeled.jpg", "image/jpeg", png],
  ] as const) {
    expect(
      (
        await page.request.post("/api/upload", {
          multipart: { file: { name, mimeType, buffer } },
        })
      ).status(),
    ).toBe(400);
  }
  const anonymousUpload = await playwright.request.newContext({
    baseURL: "http://localhost:3018",
  });
  expect(
    (
      await anonymousUpload.post("/api/upload", {
        multipart: {
          file: { name: "test.png", mimeType: "image/png", buffer: png },
        },
      })
    ).status(),
  ).toBe(401);
  await anonymousUpload.dispose();
  if (imageUrl.startsWith("/api/uploads/")) {
    const name = basename(imageUrl);
    expect(name).toMatch(/^[0-9a-f-]{36}\.webp$/);
    uploadedFiles.push(name);
  }
  const savedImage = await page.request.get(imageUrl);
  expect(savedImage.status()).toBe(200);
  expect(savedImage.headers()["content-type"]).toBe("image/webp");
  const imageMetadata = await sharp(await savedImage.body()).metadata();
  expect(imageMetadata.width).toBe(96);
  expect(imageMetadata.height).toBe(96);
  const companyName = `Test company ${Date.now()}`;
  const submitted = await page.request.post("/api/company", {
    data: {
      name: companyName,
      url: "https://example.com",
      tagline: "A staging-only end to end test company.",
      description: "Test fixture",
      logo_url: imageUrl,
      hero_image_url: imageUrl,
      category: "SaaS",
    },
  });
  expect(submitted.status()).toBe(201);
  const { id } = await submitted.json();
  fixtures.push(id);
  const admin = await playwright.request.newContext({
    baseURL: "http://localhost:3018",
  });
  expect(
    (
      await admin.post("/api/auth/login", {
        data: {
          email: settings.ADMIN_EMAIL,
          password: settings.ADMIN_PASSWORD,
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await admin.post("/api/admin/action", {
        data: { type: "company", id, action: "approve" },
      })
    ).status(),
  ).toBe(200);
  const claim = await page.request.post(`/api/company/${id}/claim`, {
    data: { method: "manual" },
  });
  expect(claim.status()).toBe(200);
  const claimId = (await claim.json()).id;
  expect(
    (
      await admin.post("/api/admin/action", {
        data: { type: "claim", id: claimId, action: "approve" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await page.request.get(`/api/company/${id}/analytics`)).status(),
  ).toBe(200);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: companyName })).toBeVisible();
  await expect(
    page.getByText("Card impressions", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await admin.post("/api/admin/action", {
        data: { type: "company", id, action: "hide" },
      })
    ).status(),
  ).toBe(200);
  await admin.dispose();
});
test("social and portrait cards are real PNGs with the requested dimensions", async ({
  request,
}) => {
  for (const [suffix, width, height] of [
    ["", 1200, 630],
    ["?format=portrait", 1080, 1350],
  ] as const) {
    const response = await request.get(`/api/share/orbit${suffix}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    const bytes = await response.body();
    expect(bytes.readUInt32BE(16)).toBe(width);
    expect(bytes.readUInt32BE(20)).toBe(height);
  }
});

test("Browse, local saves, recent history and mode preference work without registration", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.locator(".catalog-card")).toHaveCount(24);
  await page.setViewportSize({ width: 1440, height: 1000 });
  mkdirSync("artifacts/screenshots", { recursive: true });
  await page.screenshot({ path: "artifacts/screenshots/browse-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/screenshots/browse-mobile.png" });
  await page.getByLabel("Search companies").fill("Orbit");
  await expect(page.locator(".catalog-card")).toHaveCount(1);
  await page.getByLabel("Filter pricing").selectOption("free");
  await expect(
    page.getByLabel("Filter tags").locator('option[value="open source"]'),
  ).toHaveText("Open source");
  await page.getByLabel("Filter tags").selectOption("open source");
  await expect(page.locator(".catalog-card h2")).toHaveText("Orbit");
  const id = (await (await page.request.get("/api/company/orbit")).json())
    .company.id;
  const score = async () =>
    (
      await db().query(
        "SELECT sum(total_points)::int AS total FROM company_season_stats WHERE company_id=$1",
        [id],
      )
    ).rows[0].total;
  const before = await score();
  await page.getByRole("button", { name: "Save Orbit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unsave Orbit", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator(".catalog-identity a").click();
  await expect(page.locator(".company-facts")).toContainText("MADE FOR");
  await expect(page.locator(".company-facts")).toContainText("Free");
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Browse", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Saved 1", exact: true }).click();
  await expect(page.locator(".catalog-card h2")).toHaveText("Orbit");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Saved 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Recent", exact: true }).click();
  await expect(page.locator(".catalog-card h2").first()).toHaveText("Orbit");
  expect(await score()).toBe(before);
  expect(
    (await (await page.request.get("/api/auth/session")).json()).user,
  ).toBeNull();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("sponsor deck preserves the next organic card; viewability needs uninterrupted focus and clicks receive UTM tags", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "hasFocus", {
      configurable: true,
      value: () =>
        Boolean((window as Window & { adTestFocus?: boolean }).adTestFocus),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const heading = page.locator(".active-card .card-company h2");
  await expect(heading).toBeVisible();
  const served: string[] = [];
  let viewable = 0;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/ads/impression") &&
      request.postDataJSON().surface === "deck"
    )
      served.push(request.postDataJSON().exposureId);
    if (
      request.url().endsWith("/api/ads/viewable") &&
      request.postDataJSON().surface === "deck"
    )
      viewable++;
  });
  expect(served).toHaveLength(0);
  for (let i = 0; i < 6; i++) {
    const old = await heading.textContent();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(heading).not.toHaveText(old!);
  }
  const ad = page.locator(".ad-deck");
  await expect(ad).toBeVisible();
  await expect(ad).toContainText("SPONSORED");
  await expect(ad).toContainText("STAGING PREVIEW");
  await expect.poll(() => new Set(served).size).toBe(1);
  await page.waitForFunction(
    () => !!document.querySelector(".ad-deck a[href]"),
  );

  await page.waitForTimeout(1300);
  expect(viewable).toBe(0);
  await page.evaluate(() => {
    (window as Window & { adTestFocus?: boolean }).adTestFocus = true;
    window.dispatchEvent(new Event("focus"));
  });
  await page.waitForTimeout(550);
  await page.evaluate(() => {
    (window as Window & { adTestFocus?: boolean }).adTestFocus = false;
    window.dispatchEvent(new Event("blur"));
  });
  await page.waitForTimeout(700);
  expect(viewable).toBe(0);
  await page.evaluate(() => {
    (window as Window & { adTestFocus?: boolean }).adTestFocus = true;
    window.dispatchEvent(new Event("focus"));
  });
  await expect.poll(() => viewable).toBe(1);
  const exposed = await heading.textContent();
  const exposureId = served[0];
  await expect
    .poll(
      async () =>
        (
          await db().query("SELECT viewable_at FROM ad_exposures WHERE id=$1", [
            exposureId,
          ])
        ).rows[0]?.viewable_at,
    )
    .not.toBeNull();
  const href = await ad.locator("a").getAttribute("href");
  const response = await page.request.get(href!, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  const destination = new URL(response.headers().location);
  expect(destination.searchParams.get("utm_source")).toBe("backing");
  expect(destination.searchParams.get("utm_content")).toBe("deck");
  const click = await db().query(
    "SELECT * FROM ad_clicks WHERE exposure_id=$1",
    [exposureId],
  );
  expect(click.rowCount).toBe(1);
  await page.screenshot({
    path: "artifacts/screenshots/sponsor-card-mobile.png",
  });
  await page
    .getByRole("button", { name: "Continue discovering", exact: true })
    .click();
  await expect(ad).toHaveCount(0);
  await expect(heading).toHaveText(exposed!);
});

test("advertiser reports are private, show only their placements and booking uses Dodo", async ({
  page,
  playwright,
}) => {
  const email = `advertiser-${randomUUID()}@example.com`;
  accountEmails.push(email);
  const registration = await page.request.post("/api/auth/register", {
    data: { email, password: "a-test-advertiser-password" },
  });
  expect(registration.status()).toBe(200);
  const owner = (await registration.json()).user.id;
  const order = randomUUID();
  campaignFixtures.push(order);
  await db().query(
    "INSERT INTO placement_orders(id,advertiser,creative,destination_url,position,starts_at,ends_at,amount_usd,email,advertiser_id,payment_status,moderation_status) VALUES($1,'Report fixture','Your audience is here.','https://example.com','deck',now()+interval '60 days',now()+interval '61 days',49,$2,$3,'pending','pending')",
    [order, email, owner],
  );
  const stranger = await playwright.request.newContext({
    baseURL: "http://localhost:3018",
  });
  expect((await stranger.get(`/api/campaigns/${order}`)).status()).toBe(401);
  const otherEmail = `other-advertiser-${randomUUID()}@example.com`;
  accountEmails.push(otherEmail);
  await stranger.post("/api/auth/register", {
    data: { email: otherEmail, password: "a-test-advertiser-password" },
  });
  expect((await stranger.get(`/api/campaigns/${order}`)).status()).toBe(404);
  expect(
    (await (await stranger.get("/api/campaigns")).json()).campaigns,
  ).toHaveLength(0);
  await stranger.dispose();
  await page.goto(`/campaigns?order=${order}`);
  await expect(page.locator(".campaign-report h2")).toHaveText(
    "Your audience is here.",
  );
  await expect(
    page.getByText("Unique audience", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Viewable impressions", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tagged outbound visits", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/advertiser-report.png",
  });
  await page.goto("/advertise");
  await expect(page.getByRole("button", { name: /Sponsor card/ })).toHaveClass(
    /active/,
  );
  await page.getByLabel("Advertiser name").fill("Advertiser fixture");
  await page.getByLabel("Receipt email").fill(email);
  await page
    .getByLabel("A short, good line")
    .fill("A useful company for curious people.");
  await page
    .getByLabel("What makes this worth a look?")
    .fill("Build websites without busywork.");
  await page
    .getByLabel("Sponsor logo", { exact: true })
    .fill("https://example.com/logo.png");
  await page
    .getByLabel("Real product screenshot", { exact: true })
    .fill("https://example.com/screen.png");
  await page.getByLabel("Destination URL").fill("https://example.com");
  await page.getByRole("button", { name: "Book your spot" }).click();
  await expect(page.locator(".alert")).toContainText(
    "Dodo Payments is not configured",
  );
});

test("active sponsor strips and enriched cards fit small mobile screens; discovery extensions remain accessible", async ({
  page,
}) => {
  const order = randomUUID();
  campaignFixtures.push(order);
  await db().query(
    "INSERT INTO placement_orders(id,advertiser,creative,destination_url,position,starts_at,ends_at,amount_usd,email,payment_status,moderation_status,is_demo,cta_label) VALUES($1,'Strip preview','A useful tool for curious builders.','https://example.com','both',now()-interval '1 hour',now()+interval '1 hour',0,'preview@example.com','demo','approved',true,'Visit sponsor')",
    [order],
  );
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await expect(page.locator(".banner-ad")).toHaveCount(2);
  await expect(page.locator(".active-card .card-company h2")).toBeVisible();
  const bottom = await page.locator(".active-card .card-bottom").boundingBox();
  const back = await page
    .getByRole("button", { name: "Back +1" })
    .boundingBox();
  expect(bottom!.y + bottom!.height).toBeLessThan(back!.y);
  expect(back!.y + back!.height).toBeLessThan(640);
  await page.screenshot({
    path: "artifacts/screenshots/swipe-small-mobile.png",
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await page.locator(".catalog-card").first().waitFor();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await db().query("DELETE FROM placement_orders WHERE id=$1", [order]);
});

test("all product categories are selectable and staging has distinct advertisements", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".ad-top")).toContainText("Stacklane");
  await expect(page.locator(".ad-bottom")).toContainText("Daylight");
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  const picker = page.getByRole("combobox", {
    name: "All categories",
    exact: true,
  });
  await expect(picker.locator("option")).toHaveCount(31);
  await picker.selectOption("Health, Fitness & Wellness");
  await expect(page.locator(".catalog-card")).toHaveCount(4);
  await expect(page.locator(".catalog-identity span").first()).toHaveText(
    "Health, Fitness & Wellness",
  );
  await page.getByLabel("Filter tags").selectOption("fitness");
  await expect(page.locator(".useful-tags").first()).toContainText("Fitness");
  const inventory = (await (await page.request.get("/api/placements")).json())
    .placements;
  expect(
    inventory.filter((ad: { is_demo: boolean }) => ad.is_demo),
  ).toHaveLength(3);
  expect(
    new Set(inventory.map((ad: { advertiser: string }) => ad.advertiser)).size,
  ).toBe(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
