import { test } from "node:test";
import assert from "node:assert/strict";
import {
  siteOrigin,
  absoluteUrl,
  indexable,
  pageMetadata,
  jsonLd,
  categorySlug,
} from "../src/lib/seo";
import { categories } from "../src/lib/taxonomy";

test("production indexing waits for a real HTTPS origin; staging never indexes", () => {
  const previous = {
    APP_ENV: process.env.APP_ENV,
    APP_URL: process.env.APP_URL,
  };
  try {
    process.env.APP_ENV = "production";
    for (const value of [
      "",
      "http://localhost:3018",
      "https://localhost:3018",
      "https://127.0.0.1",
      "https://example.com/path",
      "https://user:secret@example.com",
      "invalid",
    ]) {
      process.env.APP_URL = value;
      assert.equal(siteOrigin(), undefined);
      assert.equal(indexable(), false);
      assert.equal(
        pageMetadata("Title", "Description", "/").alternates,
        undefined,
      );
    }
    process.env.APP_URL = "https://backing.example/";
    assert.equal(indexable(), true);
    assert.equal(
      absoluteUrl("/company/orbit"),
      "https://backing.example/company/orbit",
    );
    assert.equal(
      (
        pageMetadata("Private", "Description", "/dashboard", { noindex: true })
          .robots as { index: boolean }
      ).index,
      false,
    );
    process.env.APP_ENV = "staging";
    assert.equal(indexable(), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test("JSON-LD cannot close the script tag with listing content", () => {
  const data = {
    name: "</script><script>alert(1)</script>",
    description: 'Text & "quotes"',
  };
  const encoded = jsonLd(data);
  assert.equal(encoded.includes("<"), false);
  assert.deepEqual(JSON.parse(encoded), data);
});
test("all category URLs are stable, unique and URL-safe", () => {
  const slugs = categories.map(categorySlug);
  assert.equal(new Set(slugs).size, 30);
  for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});
