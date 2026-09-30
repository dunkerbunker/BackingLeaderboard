"use client";
import type { ReactNode } from "react";
import type { Company, Season } from "@/lib/leaderboard";
import { LibraryProvider } from "./library";
import { Campaigns } from "./campaigns";
import { Shell } from "./ui";
import { Discover } from "./discover";
import { Board, CompanyPage, HallOfFame } from "./boards";
import { Advertise, Claim, Sponsor, Submit } from "./forms";
import { Admin, Dashboard } from "./dashboard";
import { About, Rules } from "./static";
export function App({
  view,
  content,
  initialBoard,
  initialCompany,
  initialWinners,
  shareUrl,
}: {
  view: string[];
  content?: ReactNode;
  initialBoard?: { companies: Company[]; season: Season };
  initialCompany?: Company & { season: Season; gap: number };
  initialWinners?: { companies: Company[]; season: Season }[];
  shareUrl?: string;
}) {
  const page = view[0] || "";
  return (
    <LibraryProvider>
      <Shell active={`/${page}`}>
        {page === "" ? (
          <Discover />
        ) : page === "leaderboard" ? (
          <Board initial={initialBoard} />
        ) : page === "company" ? (
          <CompanyPage
            key={view[1]}
            slug={view[1]}
            initial={initialCompany}
            shareUrl={shareUrl}
          />
        ) : page === "hall-of-fame" ? (
          <HallOfFame initial={initialWinners} />
        ) : page === "companies" || page === "categories" ? (
          content
        ) : page === "submit" ? (
          <Submit />
        ) : page === "claim" ? (
          <Claim slug={view[1]} />
        ) : page === "sponsor" ? (
          <Sponsor slug={view[1]} />
        ) : page === "advertise" ? (
          <Advertise />
        ) : page === "campaigns" ? (
          <Campaigns />
        ) : page === "dashboard" ? (
          <Dashboard />
        ) : page === "admin" ? (
          <Admin />
        ) : page === "about" ? (
          <About />
        ) : (
          <Rules />
        )}
        {page === "" && content}
      </Shell>
    </LibraryProvider>
  );
}
