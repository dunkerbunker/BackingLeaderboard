import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("companies, rankings and category directories are readable without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto("http://localhost:3018/company/orbit?ref=share");
    await expect(
      page.getByRole("heading", { name: "Orbit", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".profile-score")).toBeVisible();
    await expect(page.locator(".company-facts")).toBeVisible();
    expect(
      await page.locator('link[rel="canonical"]').getAttribute("href"),
    ).toBe("http://localhost:3018/company/orbit");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "http://localhost:3018/api/share/orbit",
    );
    await page.goto("http://localhost:3018/leaderboard");
    expect(await page.locator(".board-row").count()).toBeGreaterThanOrEqual(
      120,
    );
    await page.goto("http://localhost:3018/categories");
    await expect(page.locator(".category-directory > a")).toHaveCount(30);
    await page
      .getByRole("link", { name: /Developer Tools 4 companies/ })
      .click();
    await expect(page.locator(".public-company-grid article")).toHaveCount(4);
    await page.goto("http://localhost:3018/companies?page=2&ref=share");
    await expect(page.locator(".public-company-grid article")).toHaveCount(24);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "http://localhost:3018/companies?page=2",
    );
    await page.getByRole("link", { name: "Next →", exact: true }).click();
    await expect(page).toHaveURL(/page=3/);
    await page.goto("http://localhost:3018/");
    await expect(
      page.getByRole("link", { name: "Explore all companies →" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
test("social crawlers receive complete head metadata and valid large PNG previews", async ({
  request,
}) => {
  for (const path of ["/", "/leaderboard", "/company/orbit", "/categories"]) {
    const response = await request.get(path, {
      headers: { "User-Agent": "Twitterbot/1.0" },
    });
    expect(response.status()).toBe(200);
    const head = (await response.text()).split("</head>")[0];
    expect(head).toContain('property="og:title"');
    expect(head).toContain('property="og:description"');
    expect(head).toContain('property="og:image"');
    expect(head).toContain('name="twitter:card" content="summary_large_image"');
    expect(head).toContain('rel="canonical"');
  }
  for (const path of [
    "/social/site.png",
    "/social/leaderboard.png",
    "/api/share/orbit",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    const data = await response.body();
    expect(data.readUInt32BE(16)).toBe(1200);
    expect(data.readUInt32BE(20)).toBe(630);
  }
});
test("staging is excluded from indexes, crawler guidance is available and invalid pages return 404", async ({
  request,
}) => {
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Disallow: /",
  );
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "<loc>",
  );
  const guide = await request.get("/llms.txt");
  expect(guide.headers()["content-type"]).toContain("text/plain");
  expect(await guide.text()).toContain("not a quality certification");
  for (const path of [
    "/categories/not-a-category",
    "/companies?page=0",
    "/companies?page=9999",
    "/social/unknown.png",
  ])
    expect((await request.get(path)).status()).toBe(404);
});
test("new directory pages are accessible and fit mobile screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/companies",
    "/categories",
    "/categories/developer-tools",
  ]) {
    await page.goto(path);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/companies");
  await page.screenshot({
    path: "artifacts/screenshots/public-directory-mobile.png",
    fullPage: false,
  });
});
