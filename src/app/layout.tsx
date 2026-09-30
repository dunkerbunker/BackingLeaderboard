import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/components/swipe-discovery.css";
import "@/components/discovery-library.css";
import "@/components/public-directory.css";
import { pageMetadata, siteOrigin, siteDescription } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  ...pageMetadata("Discover useful companies", siteDescription, "/"),
  metadataBase: siteOrigin() ? new URL(siteOrigin()!) : undefined,
  title: {
    default: "Backing — good companies need a little backing.",
    template: "%s · Backing",
  },
  applicationName: "Backing",
  category: "Company discovery",
  icons: {
    icon: [{ url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [
      {
        url: "/brand/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        {process.env.APP_ENV === "staging" && (
          <aside
            aria-label="Staging environment notice"
            className="staging-bar"
          >
            STAGING · Demo company data · Payments use Dodo test mode
          </aside>
        )}
        {children}
      </body>
    </html>
  );
}
