import Link from "next/link";
import {
  ArrowRight,
  Asterisk,
  Compass,
  Plus,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { PageHeading } from "./ui";
export function About() {
  return (
    <div className="narrow-container prose">
      <PageHeading
        eyebrow="A SMALL IDEA FOR A BETTER INTERNET"
        title="Good things need a little backing."
      >
        There are a lot of good companies out there. Let’s help them get found.
      </PageHeading>
      <div className="about-illustration">
        <Compass size={54} />
        <Plus size={29} />
        <Users size={54} />
        <span>=</span>
        <Asterisk size={62} />
      </div>
      <h2>Five seconds. One good discovery.</h2>
      <p>
        Backing is a discovery game for companies. Swipe through the stack. Skip
        what’s not for you. Give a Back to something you like. No account
        needed, no reviews to write, no complicated algorithm to figure out.
      </p>
      <h2>One score. Two transparent ingredients.</h2>
      <p>
        Every valid community Back adds one point. Every US dollar of confirmed
        sponsorship adds one sponsored point. They contribute to the same weekly
        leaderboard, with both ingredients shown separately on each company’s
        page.
      </p>
      <p>
        Sponsorship buys promotional backing. It does not represent a person’s
        endorsement, and it never changes how often a company appears in the
        organic discovery feed.
      </p>
      <h2>A fair shot, every week.</h2>
      <p>
        Every Monday at 00:00 UTC, the board starts fresh. New ideas can
        compete, past champions keep their place in the Hall of Fame, and the
        internet gets another week to discover something good.
      </p>
      <section aria-label="Common questions about Backing">
        <h2>A few things you might be wondering.</h2>
        <h3>How do I find companies in a particular category?</h3>
        <p>
          Use <Link href="/categories">the category directory</Link> to browse
          AI, developer tools, marketing, design and other interests. Each
          company profile explains its purpose, audience and pricing model. The
          discovery page also offers searchable Browse mode alongside Swipe.
        </p>
        <h3>Do I need an account to discover or support a company?</h3>
        <p>
          No. You can discover, Back and save companies without registering.
          Your saved shortlist and recently viewed companies stay in this
          browser. Saving a company does not add a leaderboard point.
        </p>
        <h3>Can a company pay to rank higher?</h3>
        <p>
          Yes. Confirmed sponsorship adds sponsored points, which count toward
          the weekly total. Company profiles show community and sponsored points
          separately. A high rank is visibility, not a review or quality
          guarantee. Sponsorship does not increase organic discovery frequency.
        </p>
        <h3>Are advertisements the same as sponsored backing?</h3>
        <p>
          No. Labeled sponsor cards and banner placements are advertising. They
          add no leaderboard points. <Link href="/rules">The rules</Link>
          explain both types of promotion and how weekly scores are calculated.
        </p>
      </section>
      <Link href="/" className="button back-button">
        Discover your next favorite <ArrowRight size={17} />
      </Link>
    </div>
  );
}
export function Rules() {
  return (
    <div className="narrow-container prose">
      <PageHeading
        eyebrow="NO SECRET ALGORITHM"
        title="A simple game. Clear rules."
      >
        If a score matters, you should be able to see where it comes from.
      </PageHeading>
      <div className="rule-equation">
        <span>
          <Users size={21} /> 1 Back = 1 point
        </span>
        <Plus size={18} />
        <span>
          <Zap size={21} /> $1 = 1 sponsored point
        </span>
      </div>
      <h2>01. Community backing</h2>
      <p>
        You can give each company one Back per valid device or user in each
        weekly season. Skipping is free and adds no points. You can discover and
        Back without registering. Anonymous identity uses a signed device
        cookie.
      </p>
      <h2>02. Sponsored backing</h2>
      <p>
        One confirmed US dollar adds exactly one sponsored point. It is shown
        separately from community backing on company pages. Applicable taxes do
        not purchase points. Only verified, successful server-side payment
        confirmations count; returning from checkout is not a payment
        confirmation.
      </p>
      <p>
        Backing is credited to the active season when payment is confirmed, even
        if checkout began before the weekly reset. Refunds remove all points
        from that sponsorship order, including partial refunds. Disputed
        payments are withheld; winning a dispute restores those points.
      </p>
      <h2>03. The weekly leaderboard</h2>
      <p>
        The total is community points plus sponsored points. Higher scores rank
        first. Ties go to the company that reached that score earlier; equal
        timestamps use company creation time and ID as a deterministic fallback.
        Seasons run Monday 00:00 UTC through the following Monday. Historical
        winners stay in the Hall of Fame. Fraud and payment adjustments can
        correct archived scores.
      </p>
      <p>
        Movement compares with the previous scheduled ranking snapshot. A
        company with no earlier snapshot shows a dash.
      </p>
      <h2>04. A fair discovery feed</h2>
      <p>
        Rank never decides what you discover. The feed excludes companies you’ve
        already acted on this week, prioritizes companies with fewer valid
        impressions, and randomizes within an exposure band. New companies start
        with zero impressions and get priority. Sponsored points don’t buy feed
        frequency.
      </p>
      <h2>05. Trust comes first</h2>
      <p>
        We use signed device identity, request limits, velocity signals, and bot
        checks when activity looks suspicious. Backs may be held for review or
        removed retroactively. Scams, malware, impersonation, and prohibited
        content are not welcome. Report a company from its profile so a
        moderator can review it.
      </p>
      <h2>06. Sponsor placements</h2>
      <p>
        Clearly labelled sponsor cards and top and bottom strips are separate
        advertising inventory. They add zero leaderboard points. Creatives
        require approval. Bookings are in UTC and cannot overlap the same
        placement. If a delayed payment creates a booking conflict, moderators
        will arrange a refund or replacement dates.
      </p>
      <h2>07. Your privacy</h2>
      <p>
        Backing stores a signed anonymous device cookie and hashed device and
        network identifiers for abuse prevention. Owners provide their email and
        company information. Analytics count product interactions and traffic
        sources without publishing individual visitors. Clearing cookies does
        not entitle anyone to extra backs. Your preferred discovery mode, saved
        companies and recent history are kept locally in this browser without
        registration. You can clear saved companies and history from their tabs.
        Advertiser reports contain aggregate browser reach and interactions;
        outbound visits measure tagged redirects, not confirmed conversions.
      </p>
      <div className="trust-footer">
        <ShieldCheck size={22} />
        <span>
          Company ownership is verified independently of ranking. A high score
          is visibility, not a quality certification.
        </span>
      </div>
      <Link href="/" className="button back-button">
        Give something good a Back <ArrowRight size={17} />
      </Link>
    </div>
  );
}
