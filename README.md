# Backing

Responsive company discovery and a weekly leaderboard implementing `Backing_Swipe_Leaderboard_PRD.pdf` v1.1. Built with Next.js, React, TypeScript, PostgreSQL, Dodo's official SDK, and optional Redis, Turnstile, Resend, and S3/R2. Docker is not required.

## Run locally

Use Node.js 22+. Both supplied **live PostgreSQL databases are configured and migrated**. Staging has 120 labelled demo companies, traceable demo community backs, and two archived demo seasons. Production has no demo listings or fabricated payments.

```sh
npm ci
npm run db:migrate:staging
npm run db:seed:staging
npm run dev:staging
```

Open http://localhost:3018. Standard `npm run dev` also loads `.env.staging`. Discover with swipes, buttons, Left/Right arrows, or Space to Back. No account is needed. `/dashboard` supports owner registration; `/admin` accepts the generated `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the selected environment file.

Discovery uses a viewport-sized swipe deck on mobile and desktop. Pointer drags update transforms directly, distance and velocity determine a swipe, and short drags snap back. Button gestures dismiss in 220 ms; keyboard and reduced-motion actions advance immediately. A buffered queue and preloaded images keep the next card ready while actions save in the background. Only the visible card counts as an impression, and rapid actions record exposure atomically. Points and rank appear only after server confirmation; failed saves support retry and returning the card to the deck.

## Docker (port 3010)

The multi-stage Dockerfile builds Next.js standalone output and runs as a
non-root user. Compose connects to the selected existing live PostgreSQL
instance; it does not create a replacement database. Environment files are
injected at runtime and excluded from the image and build context.

```sh
# Staging: the configured DOCKER_APP_URL is http://localhost:3010.
docker compose --env-file .env.staging -p backing-staging up -d --build
# First deployment only: bring existing local uploaded files into the volume.
docker compose --env-file .env.staging -p backing-staging cp ./data/uploads/. app:/app/data/uploads
```

Open http://localhost:3010. Uploads persist in a named volume across container
rebuilds and `docker compose down`. Do not use `down -v` unless you intend to
remove that environment's uploaded files. Back up the volume along with the DB.
The Docker runtime supplies `PORT=3010` and `UPLOAD_DIR=/app/data/uploads`.
Local development remains on port 3018.

For production, set `.env.production`'s `APP_URL` to the actual public HTTPS
origin, then use its separate project and volume:

```sh
docker compose --env-file .env.production -p backing-production up -d --build
```

`DOCKER_APP_URL`, when set, overrides `APP_URL` for containers. Production's
currently empty URL remains empty, so indexing and checkout configuration wait
for the real domain. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is the only browser build
argument; rebuild when changing it. Serve production behind your HTTPS reverse
proxy. Staging and production cannot both publish host port 3010 on the same
machine; run them on separate hosts or stop one before starting the other.
Use the same project name for subsequent commands so uploads stay attached.
Compose uses an explicit private subnet because this machine's default Docker
address pools are exhausted. `DOCKER_SUBNET` can select a different free range;
the configured production subnet is separate from staging's. Existing networks
are not removed or reconfigured.

Database migrations are explicit, rather than part of every app restart:

```sh
docker compose --env-file .env.staging -p backing-staging run --rm --build tools
# Seed only staging, if needed:
docker compose --env-file .env.staging -p backing-staging run --rm tools node --import tsx scripts/db.ts seed
# Production migrations (no demo seeding):
docker compose --env-file .env.production -p backing-production run --rm --build tools
```

The optional `tools` service includes the migration and maintenance scripts.
Its default command runs migrations. The app image includes only runtime
files, static assets and required dependencies. If using `DATABASE_SSL_CA_FILE`,
mount your CA read-only into both services and configure its container path;
certificate files are intentionally excluded from images. S3/R2 storage can
be configured using the existing environment variables instead of local uploads.
See the [official Docker Next.js guide](https://docs.docker.com/guides/nextjs/)
for the standalone deployment approach.

## Environment separation

| File              | Purpose                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| `.env.staging`    | Live staging DB, independent secrets, Dodo test mode, localhost URL                |
| `.env.production` | Live production DB, separate secrets, Dodo live mode; `APP_URL` deliberately blank |
| `.env.local`      | Local development using staging                                                    |
| `.env.example`    | Safe template, no real credentials                                                 |

All real environment files are ignored by Git. Admin passwords and session secrets differ between environments. Read them from those local files; do not commit them. Only the public Turnstile site key is exposed to browsers. Environment scripts load their selected values explicitly, overriding the local defaults.

```sh
npm run db:check:staging
npm run db:check:production
npm run db:migrate:production
npm run build:production
npm run start:production
```

Build separately for each environment. Stop the dev server before building in the same checkout. `build:staging` / `start:staging` provide a staging production-mode build. For hosted deployment, inject the selected values into the host's secret manager and use `npm run build` / `npm start`.

Set each deployed `APP_URL` to its HTTPS origin. It controls checkout returns, verification emails, metadata, sitemap, and origin checks. Production cookies are Secure, HttpOnly, and SameSite=Lax. Database connections use the supplied `sslmode=require` for encryption; set `DATABASE_SSL_CA_FILE` to a trusted PEM CA to also validate the server certificate. The supplied IP-based connection currently encrypts without CA verification.

## Dodo configuration

Payments are implemented and show an unavailable message until configured. There is no fake-success checkout fallback.

1. Create two **one-time USD pay-what-you-want** products: Sponsored Backing and Sponsor Placement. Use tax-exclusive pricing. Checkout receives amounts in cents; discounts and currency changes are disabled.
2. Set `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_BACKING_PRODUCT_ID`, and `DODO_PLACEMENT_PRODUCT_ID`. Use staging `test_mode` and production `live_mode`.
3. Set `APP_URL` and register `https://YOUR_ORIGIN/api/dodo/webhook` in Dodo.
4. Subscribe to `payment.succeeded`, `payment.failed`, `refund.succeeded`, and dispute lifecycle events.
5. Complete a test-mode Dodo checkout before enabling live payments.

The server verifies raw webhook signatures and fetches authoritative payment data for success/refund/dispute events. Credit requires successful payment, USD, matching pre-tax amount, order environment, checkout session, and product. Unique IDs and row locks make retries/concurrent events idempotent. Browser redirects only poll status and never award points.

Confirmation credits the active season. Refunds, including partial refunds, remove the whole order's sponsored backing. Disputes withhold points and successful resolution restores previous credit. Late events are reconciled against current provider state. Sponsor cards and strips add **zero** points. A delayed payment after an expired reservation may conflict with a newer booking; the moderator must arrange a refund or replacement dates in Dodo.

## Owners, assets, and moderation

- Owner email/password accounts use salted scrypt and signed sessions. Analytics require verified ownership.
- Submissions require name, HTTPS URL, logo, screenshot, category, and a tagline of at most 80 characters; they remain pending until approved.
- `/claim/[slug]` supports DNS TXT, HTML meta tag, domain-email verification, and manual moderator review. DNS/HTML/manual work immediately. HTML verification pins validated public DNS addresses, disables redirects, and limits body size/time to prevent SSRF.
- Email claims require `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_URL`. The other claim methods work without email credentials.
- PNG/JPG/WebP uploads use `UPLOAD_DIR` immediately. Hosted deployments need a persistent writable volume or S3/R2 via `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_URL`. SVG uploads are rejected.
- `/admin` previews submissions and destination URLs, approves/rejects/hides listings, approves claims, reviews suspicious backs, resolves abuse reports, and moderates paid creatives. Actions are audited.
- `/dashboard` shows impressions, backs, skips, backing rate, profile views, outbound clicks, spend, rank, daily events, and traffic sources. These are first-party interaction counts, not independently audited ad reach.

## Fraud and rate limiting

Signed anonymous cookies and database uniqueness enforce one Back per company/device/season. Authenticated owner identity adds cross-device uniqueness. IP/device/endpoint limits, velocity checks, and risk signals precede mutation. Suspicious backs are withheld from scores and can be reviewed.

`REDIS_URL` enables atomic Redis rate limits; atomic PostgreSQL counters work without Redis and serve as its failure fallback. `TURNSTILE_SECRET_KEY` plus `NEXT_PUBLIC_TURNSTILE_SITE_KEY` enable risk-triggered challenges. Without those keys, suspicious activity stays held for moderation. `IPINFO_TOKEN` enables network reputation; `BLOCKED_ASNS` accepts a comma-separated ASN policy. Available network signals depend on your IPinfo plan.

Keep `TRUST_PROXY=false` for direct Next.js access. Enable it only behind a trusted reverse proxy that replaces forwarded headers and blocks direct app-server access, so IP limits can identify visitors accurately.

## Weekly operations and sharing

Seasons reset Monday 00:00 UTC. Request-time season selection creates the active week and archives older seasons, so scores reset without an exact-boundary cron. Feed selection excludes acted-on companies, favors the lowest valid-impression band, and randomizes within that band. Rank and sponsorship never influence feed frequency. New companies start at zero impressions. Refreshing the same company/device/season does not inflate valid impressions.

On long-lived Node servers, instrumentation performs maintenance each minute and captures movement snapshots at most every 15 minutes using a database timestamp/lock. Serverless hosts can freeze idle processes: use an external scheduler every 15 minutes for regular snapshots and counter cleanup. Multiple replicas safely share the same gate.

```sh
npm run ops:staging
npm run ops:production
```

Run the selected command from this directory through platform scheduling, cron, or Windows Task Scheduler. Archived seasons power Hall of Fame and downloadable winner badges. Fraud/payment corrections can adjust historical scores.

Real PNG share images: `/api/share/SLUG` (1200x630), `?format=portrait` (1080x1350), and `?season=UUID&badge=true` for a champion. Company Open Graph metadata uses the same image. Sharing supports copy, X, LinkedIn, WhatsApp, and download.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build:production
```

Unit tests cover UTC boundaries, input validation, SSRF, passwords, signed identity, payment reconciliation, and streamed-body limits. Live staging integration tests cover duplicate/concurrent payments, amount/currency validation, refunds, dispute restoration, and season rollover. Browser tests cover anonymous backing, duplicates, keyboard and mobile controls, score transparency, private analytics, origin checks, submission/moderation/claim, unavailable checkout, and PNG dimensions.

Integration tests refuse production and delete their own fixtures. Browser tests use staging and create test-only accounts/listings. Keep all tests that change business data on staging.

See `docs/PRD-coverage.md` for the requirement map. Reviewed layout screenshots are in `artifacts/screenshots/`.

Search discovery, AI crawler access, link previews and verified image uploads
are described in [SEO and asset storage](docs/SEO-and-assets.md), including the
production domain and persistent-storage setup needed at launch.

## Browse, shortlists and advertiser reporting

The home page offers Swipe, Browse, Saved and Recent. Browse searches names, descriptions, audiences and tags, with category, tag and pricing filters and 24 companies per page. Scores do not determine directory order. Company submission collects what the product does, its audience, pricing, useful tags, a logo and a product screenshot; profiles show these details. Legacy listings can show “Pricing not provided.”

Mode preference and up to 100 saved / 50 recently viewed company IDs are stored in `backing-library-v1` browser storage. No registration is needed. Saving is separate from backing and adds no points. Recent history records actual visible swipe heads and opened profiles, not grid preloads. Lists show approved companies only and include clear-history controls. Browser-storage failures fall back to session memory with a notice; clearing site storage removes these lists.

`/advertise` books sponsor cards ($49/day), top strips ($49/day), bottom strips ($29/day), or both strips ($69/day). Sponsor cards also appear in Browse. Deck inventory is independent of strip inventory and never affects organic feed frequency. A sponsor card appears after each six organic decisions, is visibly labeled, and can be skipped in either direction or with Continue. Booking requires an advertiser account, product assets, Dodo-hosted checkout, confirmed payment and moderator approval. All monetary flows use Dodo Payments; no substitute payment provider or simulated checkout is enabled. Refunds and open/lost disputes remove paid inventory. Staging seeds three explicitly unpaid fictional sponsor previews for the top strip, bottom strip and deck (`payment_status=demo`), never a fabricated Dodo order. A paid campaign takes precedence over each preview. Production excludes unpaid previews.

`/campaigns` is private to each advertiser (admins can inspect every campaign), refreshes every 15 seconds, and reports each placement separately: served exposures, distinct browser audience, viewable impressions, unique clickers, tagged outbound redirects, click rate, daily UTC activity, discovery category, traffic source and surface. Counts use dedicated `ad_exposures` / `ad_clicks` tables; company analytics and leaderboard scores are untouched. Rendering records an exposure idempotently. At least 50% visibility for one continuous second in a visible, focused tab qualifies a viewable impression; prefetching inventory does not. Each exposure can contribute only one outbound click. Redirects retain destination parameters and add `utm_source=backing`, `utm_medium=sponsored`, `utm_campaign=<placement UUID>` and `utm_content=<surface>`.

These are first-party browser measurements, not an independently audited advertising system. Unique audience means browser identity, not cross-device people. Outbound visits are measured redirects; advertiser page loads, sales and conversions require their own analytics. Campaign reporting never publishes device hashes, IP addresses or visitor identities. Integration tests cover catalog filtering, measurement deduplication, private reporting, Dodo placement confirmation/moderation, disputes and refunds.

The 30 product intent categories follow [Outbid.lol’s category structure](https://outbid.lol/categories), with compact quick filters and a complete category picker in Swipe, Browse and the leaderboard. Existing AI / Developer tools / Productivity / Design / SaaS / Consumer listings migrate to the corresponding descriptive categories. The staging seed distributes 120 demo companies across all 30 categories and uses distinct fictional Launchpad, Stacklane and Daylight creatives. Tag labels use sentence capitalization and preserve common acronyms; canonical lowercase tag values still drive filtering.
