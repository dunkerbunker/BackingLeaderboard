import { ImageResponse } from "next/og";
import { companyBySlug, leaderboard } from "@/lib/leaderboard";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const params = new URL(req.url).searchParams;
  const season = params.get("season");
  if (season && !/^[0-9a-f-]{36}$/i.test(season))
    return new Response("Invalid season", { status: 400 });
  const company = season
    ? (await leaderboard(season)).companies.find((c) => c.slug === slug)
    : await companyBySlug(slug);
  if (!company) return new Response("Company not found", { status: 404 });
  const portrait = params.get("format") === "portrait";
  const badge = params.get("badge") === "true";
  if (badge && (!season || company.rank !== 1))
    return new Response("A winner badge requires a winning season", {
      status: 400,
    });
  const width = portrait ? 1080 : 1200,
    height = portrait ? 1350 : 630;
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#f3f5e9",
        color: "#273023",
        padding: portrait ? "80px" : "65px",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          ✳ backing.
        </div>
        <div style={{ display: "flex", fontSize: 18, color: "#7e8a6b" }}>
          GOOD THINGS DESERVE BACKING
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: portrait ? 40 : 20,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: portrait ? 42 : 25,
            color: "#6c8355",
          }}
        >
          {badge ? "WEEKLY CHAMPION" : `#${company.rank} THIS WEEK`}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: portrait ? 100 : 76,
            fontWeight: 700,
            letterSpacing: -4,
            lineHeight: 1.05,
          }}
        >
          {company.name}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: portrait ? 72 : 48,
            letterSpacing: -2,
          }}
        >
          {new Intl.NumberFormat("en-US").format(company.total_points)} backing
        </div>
        <div
          style={{
            display: "flex",
            fontSize: portrait ? 27 : 20,
            color: "#7e8a6b",
          }}
        >
          {company.community_points.toLocaleString("en-US")} community +{" "}
          {company.sponsored_points.toLocaleString("en-US")} sponsored
        </div>
        {portrait && (
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: "#7e8a6b",
              maxWidth: 850,
              lineHeight: 1.5,
              marginTop: 35,
            }}
          >
            {company.tagline}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #d6deca",
          paddingTop: 25,
        }}
      >
        <div style={{ display: "flex", fontSize: portrait ? 28 : 22 }}>
          {badge
            ? "A good week. A lasting spot."
            : "Give something good a Back."}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: portrait ? 22 : 17,
            color: "#7e8a6b",
          }}
        >
          {process.env.APP_URL ? new URL(process.env.APP_URL).host : "backing"}{" "}
          / {company.slug}
        </div>
      </div>
    </div>,
    {
      width,
      height,
      headers: {
        "Cache-Control": "public,max-age=60",
        "Content-Disposition": `inline; filename="${company.slug}-${badge ? "champion" : portrait ? "portrait" : "social"}.png"`,
      },
    },
  );
}
