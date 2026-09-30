import type { Metadata } from "next";

export const siteDescription =
  "Discover useful companies, compare what they do and who they help, and give your favorites a Back. Explore a transparent weekly leaderboard of community and sponsored backing.";
export function siteOrigin(): string | undefined {
  const value = process.env.APP_URL?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return undefined;
    if (
      process.env.APP_ENV === "production" &&
      (url.protocol !== "https:" ||
        /^(localhost|127\.|\[::1\])/.test(url.hostname))
    )
      return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}
export function absoluteUrl(path: string): string | undefined {
  const origin = siteOrigin();
  return origin ? new URL(path, origin).href : undefined;
}
export function indexable() {
  return process.env.APP_ENV === "production" && !!siteOrigin();
}
export function pageMetadata(
  title: string,
  description: string,
  path: string,
  options: { noindex?: boolean; image?: string } = {},
): Metadata {
  const url = absoluteUrl(path);
  const image = absoluteUrl(options.image || "/social/site.png");
  const shareTitle = `${title} · Backing`;
  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    robots: {
      index: indexable() && !options.noindex,
      follow: indexable(),
      googleBot: {
        index: indexable() && !options.noindex,
        follow: indexable(),
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      siteName: "Backing",
      locale: "en_US",
      title: shareTitle,
      description,
      url,
      images: image
        ? [
            {
              url: image,
              width: 1200,
              height: 630,
              alt: shareTitle,
              type: "image/png",
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: image ? [{ url: image, alt: shareTitle }] : [],
    },
  };
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
export function categorySlug(category: string) {
  return category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
