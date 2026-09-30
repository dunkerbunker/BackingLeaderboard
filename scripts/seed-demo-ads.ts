import type { PoolClient } from "pg";
export async function seedDemoAds(client: PoolClient) {
  if (process.env.APP_ENV !== "staging")
    throw new Error("Demo advertisements are restricted to staging.");
  const ads = [
    {
      id: "00000000-0000-4000-8000-000000000006",
      name: "Launchpad",
      position: "deck",
      creative: "Your next launch deserves a crowd.",
      description:
        "Bring your idea to people who love finding something new. Meet Launchpad, a fictional launch toolkit made for this staging preview.",
      cta: "Explore the demo",
      theme: 3,
    },
    {
      id: "00000000-0000-4000-8000-000000000007",
      name: "Stacklane",
      position: "top",
      creative: "Less setup. More shipping.",
      description:
        "A fictional developer workspace for teams that love to build. This is an unpaid staging advertisement.",
      cta: "Meet Stacklane",
      theme: 0,
    },
    {
      id: "00000000-0000-4000-8000-000000000008",
      name: "Daylight",
      position: "bottom",
      creative: "A little less busy. A little more daylight.",
      description:
        "A fictional calm workspace for notes, tasks and your next good idea. This is an unpaid staging advertisement.",
      cta: "Find your flow",
      theme: 1,
    },
  ];
  for (const ad of ads)
    await client.query(
      `INSERT INTO placement_orders(id,advertiser,creative,destination_url,position,starts_at,ends_at,amount_usd,email,payment_status,moderation_status,logo_url,hero_image_url,description,cta_label,is_demo) VALUES($1,$2,$3,$4,$5,now()-interval '1 day',now()+interval '30 days',0,'preview@example.com','demo','approved',$6,$7,$8,$9,true) ON CONFLICT(id) DO UPDATE SET advertiser=EXCLUDED.advertiser,creative=EXCLUDED.creative,destination_url=EXCLUDED.destination_url,position=EXCLUDED.position,logo_url=CASE WHEN placement_orders.logo_url NOT LIKE '/api/demo-asset%' AND placement_orders.logo_url <> '' THEN placement_orders.logo_url ELSE EXCLUDED.logo_url END,hero_image_url=CASE WHEN placement_orders.hero_image_url NOT LIKE '/api/demo-asset%' AND placement_orders.hero_image_url <> '' THEN placement_orders.hero_image_url ELSE EXCLUDED.hero_image_url END,description=EXCLUDED.description,cta_label=EXCLUDED.cta_label,ends_at=EXCLUDED.ends_at WHERE placement_orders.is_demo AND placement_orders.payment_status='demo'`,
      [
        ad.id,
        ad.name,
        ad.creative,
        `https://example.com/?demo=${ad.name.toLowerCase()}`,
        ad.position,
        `/api/demo-asset?kind=logo&name=${ad.name}&theme=${ad.theme}`,
        `/api/demo-asset?kind=advertisement&name=${ad.name}&theme=${ad.theme}`,
        ad.description,
        ad.cta,
      ],
    );
}
