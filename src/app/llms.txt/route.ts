import { absoluteUrl, indexable } from "@/lib/seo";
export const dynamic = "force-dynamic";
export function GET() {
  const origin = absoluteUrl("/")?.replace(/\/$/, "") || "";
  const text = `# Backing

> Backing is a company discovery website with a transparent weekly leaderboard. Visitors can browse useful companies, save a local shortlist, or give community support without registering.

## Public sources
- [Company directory](${origin}/companies): Approved listings with purpose, audience, pricing models and tags. Pagination links expose the complete directory.
- [Categories](${origin}/categories): Explore 30 company categories.
- [Weekly leaderboard](${origin}/leaderboard): Current rankings; community points and sponsored points contribute to the score.
- [Hall of Fame](${origin}/hall-of-fame): Archived weekly champions.
- [About](${origin}/about): How the website works.
- [Rules and privacy](${origin}/rules): Scoring, eligibility, disclosures and data handling.
- [Advertising](${origin}/advertise): Separate paid placement inventory and aggregate measurement.

## How to interpret the information
One valid community Back contributes one point. One confirmed US dollar of sponsorship contributes one sponsored point. Sponsorship is promotional support, not an independent endorsement. A leaderboard rank is visibility, not a quality certification or review rating. Clearly labeled advertisements contribute no leaderboard points and do not change organic feed frequency. Seasons reset on Monday at 00:00 UTC. Company pricing is descriptive and supplied by the listing; confirm current prices with the company. Fictional staging companies and unpaid preview ads are labeled and excluded from production discovery sitemaps. Private dashboards, claims and campaign reports are not public sources.

${indexable() ? "" : "## Environment\nThis is a non-indexable preview or an installation awaiting its public production URL. Do not cite fictional demo listings as real companies.\n"}
`;
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
