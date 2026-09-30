import { ImageResponse } from "next/og";
export const runtime = "nodejs";
const labels: Record<string, [string, string]> = {
  "site.png": [
    "Good companies deserve a little backing.",
    "Discover. Save. Support your next favorite.",
  ],
  "leaderboard.png": [
    "Good companies. Real backing.",
    "One weekly leaderboard. Two transparent ingredients.",
  ],
  "categories.png": [
    "Find your kind of company.",
    "30 categories. A whole lot of possibility.",
  ],
  "companies.png": [
    "Your next favorite is out there.",
    "Explore useful companies, audiences and pricing.",
  ],
  "hall-of-fame.png": [
    "A good week. A lasting spot.",
    "Meet the companies that topped the weekly leaderboard.",
  ],
};
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ image: string }> },
) {
  const { image } = await ctx.params;
  if (!Object.hasOwn(labels, image))
    return new Response("Not found", { status: 404 });
  const [headline, subtitle] = labels[image];
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#f3f5e9",
        color: "#173f2d",
        padding: "64px 72px",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            display: "flex",
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "#bfea94",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
          }}
        >
          ✳
        </div>
        <span style={{ fontSize: 36, fontWeight: 700 }}>backing.</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: -3,
            maxWidth: 980,
          }}
        >
          {headline}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#526149" }}>
          {subtitle}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 22,
          borderTop: "1px solid #cad4bf",
          fontSize: 20,
        }}
      >
        <span>COMMUNITY + SPONSORED BACKING</span>
        <span>A fresh start every Monday.</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public,max-age=86400" },
    },
  );
}
