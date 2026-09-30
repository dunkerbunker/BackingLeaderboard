// Product intent categories, inspired by https://outbid.lol/categories.
// Labels are compact; stored names and submission options remain descriptive.
export const categoryDefinitions = [
  [
    "Developer Tools",
    "Developer",
    "Build and ship software with a shared workspace for code, issues and releases.",
    "developers and small engineering teams",
    ["open source", "collaboration", "automation"],
  ],
  [
    "AI Agents & Infrastructure",
    "AI Agents",
    "Connect autonomous assistants to your tools and automate repetitive workflows.",
    "builders and teams using AI",
    ["ai agents", "integrations", "automation"],
  ],
  [
    "Marketing & Advertising",
    "Marketing",
    "Plan campaigns, manage creative and bring your next launch to the right audience.",
    "marketers and indie founders",
    ["campaigns", "growth", "launches"],
  ],
  [
    "SEO & AI Visibility",
    "SEO",
    "Discover search opportunities and track how your site appears in search and AI answers.",
    "website owners and content teams",
    ["seo", "search", "ai visibility"],
  ],
  [
    "Productivity & Personal Tools",
    "Productivity",
    "Organize notes, projects and everyday tasks in one calm workspace.",
    "independent makers and small teams",
    ["notes", "collaboration", "task management"],
  ],
  [
    "Design & Creative",
    "Design",
    "Create polished websites and prototypes without starting from scratch.",
    "designers and creative studios",
    ["no code", "prototyping", "websites"],
  ],
  [
    "Business, Finance & Legal",
    "Business",
    "Manage customers, invoices and recurring business work in one place.",
    "small businesses and founders",
    ["crm", "invoicing", "operations"],
  ],
  [
    "Analytics",
    "Analytics",
    "Turn product activity into useful dashboards and clear, actionable reports.",
    "product teams and business owners",
    ["analytics", "dashboards", "reporting"],
  ],
  [
    "Crypto, Web3 & Investing",
    "Crypto",
    "Organize research and keep a clear record of your digital asset watchlist.",
    "digital asset researchers",
    ["web3", "research", "watchlists"],
  ],
  [
    "Security, Privacy & Compliance",
    "Security",
    "Keep track of access, security checks and the evidence your team needs for audits.",
    "security teams and growing companies",
    ["privacy", "compliance", "access control"],
  ],
  [
    "Health, Fitness & Wellness",
    "Health",
    "Keep a simple log of workouts, daily routines and personal wellness goals.",
    "people building healthier routines",
    ["fitness", "habits", "wellness"],
  ],
  [
    "Social Media & Creator Tools",
    "Social",
    "Plan posts, organize collaborations and keep your content calendar moving.",
    "creators and social media teams",
    ["social media", "scheduling", "creators"],
  ],
  [
    "Leaderboards & Attention Markets",
    "Leaderboards",
    "Build public rankings that give projects a place to be discovered and supported.",
    "community builders and indie founders",
    ["leaderboards", "community", "discovery"],
  ],
  [
    "Hiring, Jobs & Careers",
    "Hiring",
    "Organize opportunities and connect your team with people who fit the role.",
    "job seekers and hiring teams",
    ["jobs", "hiring", "careers"],
  ],
  [
    "Education & Learning",
    "Education",
    "Collect learning resources and turn ambitious topics into manageable study plans.",
    "students and curious lifelong learners",
    ["learning", "courses", "study"],
  ],
  [
    "Agencies, Studios & Services",
    "Agencies",
    "Coordinate creative projects, client feedback and delivery from one workspace.",
    "agencies and independent studios",
    ["services", "clients", "collaboration"],
  ],
  [
    "Ecommerce & Retail",
    "Ecommerce",
    "Manage product collections and keep everyday store operations organized.",
    "independent retailers and store owners",
    ["ecommerce", "inventory", "stores"],
  ],
  [
    "Domains & Web Assets",
    "Domains",
    "Collect naming ideas and organize domains for your next online project.",
    "founders and website builders",
    ["domains", "branding", "websites"],
  ],
  [
    "Games & Entertainment",
    "Games",
    "Discover quick games and make a little more room for play.",
    "casual players and game enthusiasts",
    ["games", "multiplayer", "entertainment"],
  ],
  [
    "People & Profiles",
    "People",
    "Create a useful public profile for your projects, interests and work.",
    "independent professionals and makers",
    ["profiles", "portfolios", "personal"],
  ],
  [
    "Product Management",
    "Product",
    "Bring customer feedback, priorities and release plans into one clear view.",
    "product managers and startup teams",
    ["roadmaps", "feedback", "planning"],
  ],
  [
    "Writing & Content",
    "Writing",
    "Collect ideas, draft useful content and build a writing habit that lasts.",
    "writers and content teams",
    ["writing", "editing", "publishing"],
  ],
  [
    "Directories, Launch & Discovery",
    "Directories",
    "Find early products and give a new launch somewhere useful to land.",
    "curious early adopters and founders",
    ["directories", "launches", "discovery"],
  ],
  [
    "AI Media Generation",
    "AI Media",
    "Turn creative briefs into first drafts of images and visual content.",
    "creators and creative teams",
    ["ai", "images", "creative"],
  ],
  [
    "Audio, Voice & Podcasting",
    "Audio",
    "Organize recordings, transcripts and the next episode of your show.",
    "podcasters and audio creators",
    ["audio", "transcription", "podcasts"],
  ],
  [
    "Sales & Lead Generation",
    "Sales",
    "Keep outreach organized and follow up with the people who matter.",
    "sales teams and independent founders",
    ["sales", "crm", "outreach"],
  ],
  [
    "Travel, Local & Lifestyle",
    "Travel",
    "Collect places, organize itineraries and keep your next trip in one place.",
    "travelers and everyday explorers",
    ["travel", "itineraries", "local"],
  ],
  [
    "Real Estate & Property",
    "Real Estate",
    "Organize property research and compare places without losing your notes.",
    "property researchers and local agents",
    ["property", "real estate", "research"],
  ],
  [
    "Media & News",
    "News",
    "Collect the stories that matter and turn your reading list into a useful daily briefing.",
    "curious readers and media teams",
    ["news", "newsletters", "reading"],
  ],
  [
    "Other",
    "Other",
    "Make a little more room for useful ideas that do not fit a single category.",
    "curious people and everyday makers",
    ["personal", "indie", "discovery"],
  ],
] as const;
export const categories = categoryDefinitions.map(([name]) => name);
export const featuredCategories = [
  "AI Agents & Infrastructure",
  "Developer Tools",
  "Marketing & Advertising",
  "Productivity & Personal Tools",
] as const;
const legacy: Record<string, string> = {
  AI: "AI Agents & Infrastructure",
  "Developer tools": "Developer Tools",
  Productivity: "Productivity & Personal Tools",
  Design: "Design & Creative",
  SaaS: "Business, Finance & Legal",
  Consumer: "Other",
};
export function normalizeCategory(value: string) {
  return Object.hasOwn(legacy, value) ? legacy[value] : value;
}
export function categoryLabel(value: string) {
  return (
    categoryDefinitions.find(
      ([name]) => name === normalizeCategory(value),
    )?.[1] || value
  );
}
export function tagLabel(value: string) {
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  return label.replace(
    /\b(ai|api|seo|crm|ui|ux|saas|b2b|b2c)\b/gi,
    (acronym) =>
      acronym.toUpperCase() === "SAAS" ? "SaaS" : acronym.toUpperCase(),
  );
}
