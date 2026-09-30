# PRD implementation map

Source: supplied Backing PRD v1.1 PDF. Discovery was subsequently redesigned as a full-screen swipe deck with image preloading, pointer-driven transforms, velocity thresholds, background saves, and explicit retry recovery. Queue prefetching never counts as exposure.

| Requirement                                     | Implementation                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Immediate swipe discovery without registration  | `/`, pointer gestures, buttons, arrows/Space, post-action feedback                     |
| Warm canvas, white cards, green Back, sans/mono | Responsive Geist UI, restrained motion, reduced-motion support                         |
| Weekly score and separate components            | Generated total column, transaction-backed ledgers, company breakdown                  |
| UTC Monday reset and historical recognition     | Automatic seasons, `/hall-of-fame`, champion badges                                    |
| Transparent ranking and tie breaker             | Total descending, score timestamp ascending, deterministic fallback                    |
| Ranking movement                                | Database-gated snapshots, Node instrumentation, maintenance script                     |
| Fair feed independent of rank                   | Prior-action exclusions, low-impression band, randomization, new-company priority      |
| Company detail and traffic measurement          | `/company/[slug]`, profile/outbound/impression/source events                           |
| Submission and ownership                        | `/submit`, owner accounts, moderated required fields/assets                            |
| DNS/HTML/email/manual verification              | `/claim/[slug]`, server checks, moderator approval                                     |
| Private business analytics                      | `/dashboard`, authenticated analytics endpoint                                         |
| Sponsored backing and custom amounts            | `/sponsor/[slug]`, presets plus whole-dollar custom amounts                            |
| Server-confirmed payment integrity              | Official Dodo checkout, signed webhook, authoritative payment retrieval                |
| Separate ad inventory                           | `/advertise`, top/bottom/both daily strips, reservations, moderation                   |
| Fraud controls                                  | Signed devices, owner uniqueness, durable limits, velocity, Turnstile/network adapters |
| Fraud removal and abuse moderation              | `/admin`, reports, invalidation/restoration, audit trail, creative previews            |
| Shareability                                    | PNG 1200x630/1080x1350/champion, Open Graph, copy/X/LinkedIn/WhatsApp/download         |
| Accessible interaction                          | Labels, focus states, live feedback, keyboard/buttons, reduced motion                  |
| Live staging and production                     | Separate ignored environment files and migrated PostgreSQL schemas                     |
| Staging dummy data                              | 120 labelled demo companies, traceable community backs, two historic seasons           |

## Decisions

- Custom sponsorships use whole USD dollars for exact integer point conversion.
- Payment confirmation time determines the active season.
- Full and partial refunds remove the order's whole backing; disputes withhold and can restore it. Rules disclose this policy.
- Device and owner uniqueness both apply, preventing extra backs after login or across owner devices.
- Valid impressions are unique per company/device/season.
- PostgreSQL counters and persistent local uploads are working alternatives to Redis and R2/S3.
- Ad checkout reservations last 30 minutes. Late-payment conflicts enter moderation; the operator refunds or rebooks in Dodo.
- Production demo seeding is disabled. Source and moderate the launch plan's legitimate products before public launch.

## External configuration

Dodo keys/product IDs and deployment origins remain open as instructed. Domain-email verification needs an email provider key/from-address. Optional Turnstile, network reputation, Redis, and R2/S3 activate with their credentials. Owner accounts, DNS/HTML/manual claims, local uploads, durable counters, and suspicious-back withholding already work without those providers.


## Discovery and advertiser extension

| Requested behavior | Implementation |
| --- | --- |
| Swipe / Browse and remembered preference | Responsive home mode navigation; local preference; searchable paged catalog with category / tag / pricing filters |
| Anonymous Save and Recent | Browser-local ID lists, saved/profile/swipe controls, recently viewed heads/profiles, clear controls |
| Useful company information | Moderated what-it-does / audience / pricing / tags / screenshot fields on submission and company profiles |
| Visible sponsor cards | Clearly labeled independent deck inventory after six organic actions, Browse placements, stronger strip creatives |
| Dodo-only payments | Advertiser-owned placement orders, existing Dodo placement product, secure confirmation/refund/dispute lifecycle |
| Separate campaign analytics | Private `/campaigns`; dedicated served/viewable/click ledger with audience, daily UTC, source/category/surface breakdowns and UTM redirects |
