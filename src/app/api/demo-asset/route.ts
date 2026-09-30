import { demoAdArt } from "@/lib/demo-ad-art";
export function GET(req: Request) {
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") || "Orbit")
    .replace(/[<>&"']/g, "")
    .slice(0, 60);
  const theme = Number(url.searchParams.get("theme") || 0) % 6;
  const colors = [
    "#bfea94",
    "#f5ba8b",
    "#beb8ef",
    "#b2d5ed",
    "#ecd899",
    "#eab8c9",
  ];
  const color = colors[theme] || colors[0];
  const logo = url.searchParams.get("kind") === "logo";
  const svg =
    url.searchParams.get("kind") === "advertisement"
      ? demoAdArt(name, color)
      : logo
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="25" fill="${color}"/><path d="M26 26h20v20H26zm24 0h20v20H50zM26 50h20v20H26zm24 0h20v20H50z" fill="#242622"/><circle cx="60" cy="60" r="10" fill="${color}"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600"><rect width="1000" height="600" fill="${color}"/><circle cx="900" cy="50" r="220" fill="#ffffff" opacity=".16"/><circle cx="50" cy="550" r="180" fill="#ffffff" opacity=".2"/><rect x="126" y="95" width="750" height="446" rx="16" fill="#252a24" opacity=".12"/><rect x="120" y="80" width="760" height="440" rx="14" fill="#fafbf8"/><path d="M120 120h760" stroke="#e0e3db"/><circle cx="144" cy="100" r="4" fill="#d4d8cf"/><circle cx="160" cy="100" r="4" fill="#d4d8cf"/><circle cx="176" cy="100" r="4" fill="#d4d8cf"/><text x="495" y="105" text-anchor="middle" font-size="13" font-family="Arial" fill="#8b9384">${name.toLowerCase().replace(/ /g, "")}.app</text><rect x="140" y="140" width="146" height="360" rx="8" fill="#f0f2ec"/><rect x="155" y="160" width="22" height="22" rx="6" fill="#272e23"/><text x="187" y="176" font-family="Arial" font-weight="700" font-size="16" fill="#272e23">${name.split(" ")[0]}</text><rect x="155" y="210" width="116" height="30" rx="6" fill="${color}"/><path d="M172 225h74M172 262h65M172 301h80M172 340h62" stroke="#a0a798" stroke-width="5" stroke-linecap="round"/><text x="320" y="181" font-size="24" font-weight="700" font-family="Arial" fill="#272e23">Your next great idea starts here.</text><text x="320" y="208" font-size="14" font-family="Arial" fill="#89917f">A fresh space to think, make, and do.</text><rect x="320" y="240" width="520" height="92" rx="10" fill="${color}" opacity=".5"/><path d="M344 265h100m-100 21h210m-210 22h165" stroke="#526149" stroke-width="6" stroke-linecap="round" opacity=".5"/><rect x="320" y="350" width="158" height="128" rx="9" fill="#fff" stroke="#e1e5db"/><rect x="500" y="350" width="158" height="128" rx="9" fill="#fff" stroke="#e1e5db"/><rect x="680" y="350" width="158" height="128" rx="9" fill="#fff" stroke="#e1e5db"/><circle cx="349" cy="378" r="9" fill="${color}"/><circle cx="529" cy="378" r="9" fill="${color}"/><circle cx="709" cy="378" r="9" fill="${color}"/><path d="M340 408h103m-103 20h70m110-20h103m-103 20h70m110-20h103m-103 20h70" stroke="#d1d8c9" stroke-width="6" stroke-linecap="round"/></svg>`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public,max-age=86400",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
