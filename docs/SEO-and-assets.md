# Search discovery, sharing and image storage

Public content renders in the initial HTML: company profiles, live rankings,
archived champions, `/companies` and `/categories`. Directory pagination and
category links work without JavaScript. The immersive home page also links to
these public sources and explains the scoring system in visible text.

Every public page has a specific title and description, a canonical URL, Open
Graph and Twitter metadata. Tracking parameters do not create new canonical
pages; directory pagination keeps its page number. `/social/*.png` supplies
branded 1200 × 630 previews, while company previews use `/api/share/:slug` with
their current rank and separate community/sponsored totals. Company cards also
support downloadable portrait and historical champion formats.

JSON-LD describes the website, public pages, companies, breadcrumbs and directory
or leaderboard lists. It matches visible information; backing scores are not
review ratings. Listing strings are escaped before embedding JSON-LD in HTML.

## AI search

The primary work is crawlable HTML, clear entity descriptions, meaningful links
and explicit scoring/advertising disclosures. Public production pages are open
to search crawlers, including OAI-SearchBot and PerplexityBot. `/llms.txt` is a
supplemental source guide, not a guarantee of indexing or a required AI standard.
Staging stays blocked from indexing and fictional listings never enter the
production sitemap. Private dashboards, claims and reports stay excluded.

References: [Google AI features](https://developers.google.com/search/docs/appearance/ai-features),
[OpenAI crawler documentation](https://developers.openai.com/api/docs/bots).

## Uploads

Owners upload company logos and screenshots; advertisers upload creative images
through the same authenticated `/api/upload` endpoint. Accepted inputs are PNG,
JPEG and WebP, at most 5 MiB and 25 megapixels. The server fully decodes the image,
checks that its actual format matches its declared MIME type, rejects animated
and invalid inputs, applies orientation, removes metadata and creates an
optimized WebP at a maximum of 2560 pixels per side. Files receive random names.
The response includes the stored URL and dimensions. Public immutable retrieval
works without authentication, so shared links and image crawlers can load them.

Storage uses S3/R2 when configured, otherwise the runtime `UPLOAD_DIR` volume.
Partial S3 configuration fails visibly instead of silently writing to local
storage. Brand icons are actual PNG files in `public/brand`; vector UI icons
are bundled inline and need no remote image service.

```sh
npm run assets:brand
# Start staging first, then upload and verify fictional seed images through HTTP:
npm run assets:staging
```

`assets:staging` authenticates as the staging administrator, honors upload rate
limits, verifies retrieval and updates only demo company and unpaid demo ad
image references. Identical artwork can share a stored file. It is resumable:
already-stored image URLs are verified rather than uploaded again. The artwork
remains fictional; this does not turn it into real product screenshots. Owners
should upload their own accurate logos and screenshots.

## Production launch

1. Set `APP_URL` to the actual public HTTPS origin, with no path, query or
   credentials. Canonicals, sitemap URLs and shared-image URLs use it. Until
   then production indexing is disabled; no localhost production URLs are emitted.
2. Mount `UPLOAD_DIR` on persistent storage and back it up, or configure
   `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
   `S3_SECRET_ACCESS_KEY` and public HTTPS `S3_PUBLIC_URL`. The asset files on
   a development machine must be transferred with their database references
   when deploying that environment to another host. Uploaded files are ignored
   by Git and deliberately excluded from the deployment bundle.
3. Verify robots, sitemap and preview-image URLs are publicly reachable without
   a login, firewall challenge or tunnel. Staging URLs and localhost cannot
   provide public platform previews. Re-scrape shared links on social platforms
   after changes because those platforms cache previews.
4. Submit `/sitemap.xml` to your verified Google Search Console and Bing
   Webmaster accounts. External submission and ownership verification require
   the final domain and account access; neither has been configured yet.

Automated coverage checks HTML with JavaScript disabled, crawler head metadata,
PNG dimensions, canonical pagination, noindex behavior, schema escaping,
directory accessibility, the upload form, image retrieval and invalid-file
rejection. Search rankings and AI citations depend on crawler discovery and
editorial relevance and are not guaranteed by these changes.
