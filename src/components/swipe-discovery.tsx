"use client";
import { CategoryFilter } from "./category-filter";
import { SaveButton, useLibrary } from "./library";
import { pricingLabels } from "@/lib/validation";
import { Advertisement, usePlacements } from "./advertisement";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Asterisk,
  Check,
  Compass,
  Info,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  Countdown,
  Empty,
  Logo,
  money,
  Spinner,
  trafficSource,
  Visit,
} from "./ui";
import { Challenge } from "./challenge";
import type { Company, Season } from "@/lib/leaderboard";

type Card = Pick<
  Company,
  | "id"
  | "slug"
  | "name"
  | "tagline"
  | "description"
  | "url"
  | "category"
  | "logo_url"
  | "hero_image_url"
  | "verification_status"
  | "is_demo"
  | "what_it_does"
  | "target_audience"
  | "pricing_model"
  | "pricing_note"
  | "tags"
>;
type Action = { card: Card; back: boolean; season: Season };
type FailedAction = Action & {
  message: string;
  challenge: boolean;
  seasonChanged: boolean;
};
type Feedback = { title: string; detail?: string; pending?: boolean };
type Gesture = {
  pointer: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  axis: "x" | "y" | null;
};

export function SwipeDiscover() {
  const { viewed } = useLibrary();
  const [adAfter, setAdAfter] = useState(0);
  const [cards, setCards] = useState<Card[]>([]);
  const [season, setSeason] = useState<Season>();
  const [category, setCategory] = useState("All");
  const [fetching, setFetching] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [feedError, setFeedError] = useState("");
  const placements = usePlacements();
  const [count, setCount] = useState(0);
  const [backs, setBacks] = useState(0);
  const [pending, setPending] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [instant, setInstant] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();
  const [failures, setFailures] = useState<FailedAction[]>([]);
  const failed = failures[0];
  const setFailed = useCallback((value?: FailedAction) => {
    setFailures((previous) =>
      value
        ? previous.some((item) => item.card.id === value.card.id)
          ? previous.map((item) =>
              item.card.id === value.card.id ? value : item,
            )
          : [...previous, value]
        : previous.slice(1),
    );
  }, []);
  const [retrying, setRetrying] = useState(false);
  const [token, setToken] = useState<string>();
  const queue = useRef<Card[]>([]);
  const activeSeason = useRef<Season>(undefined);
  const generation = useRef(0);
  const fetchingRef = useRef(false);
  const dismissed = useRef(new Set<string>());
  const seen = useRef(new Map<string, Promise<unknown>>());
  const inFlight = useRef(new Set<string>());
  const blocked = useRef(false);
  const gesture = useRef<Gesture>(null);
  const frame = useRef<number>(0);
  const stage = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(true);
  const animation = useRef<Animation>(null);
  const current = cards[0];

  const updateQueue = useCallback((next: Card[]) => {
    queue.current = next;
    setCards(next);
  }, []);
  const fill = useCallback(
    async (filter: string, version: number) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setFetching(true);
      setFeedError("");
      const exclude = [
        ...new Set([
          ...queue.current.map((c) => c.id),
          ...Array.from(dismissed.current).slice(-80),
        ]),
      ];
      try {
        const data = await api<{ companies: Card[]; season: Season }>(
          `feed/queue?category=${encodeURIComponent(filter)}&exclude=${exclude.join(",")}`,
        );
        if (!mounted.current || version !== generation.current) return;
        if (
          activeSeason.current &&
          activeSeason.current.id !== data.season.id
        ) {
          dismissed.current.clear();
          seen.current.clear();
          queue.current = [];
        }
        activeSeason.current = data.season;
        setSeason(data.season);
        for (const card of data.companies) {
          for (const src of [card.hero_image_url, card.logo_url]) {
            const image = new window.Image();
            image.src = src;
            void image.decode().catch(() => {});
          }
        }
        const known = new Set(queue.current.map((c) => c.id));
        updateQueue([
          ...queue.current,
          ...data.companies.filter(
            (c) => !known.has(c.id) && !dismissed.current.has(c.id),
          ),
        ]);
        setExhausted(data.companies.length === 0);
      } catch (e) {
        if (mounted.current && version === generation.current)
          setFeedError((e as Error).message);
      } finally {
        if (mounted.current) {
          fetchingRef.current = false;
          setFetching(false);
        }
      }
    },
    [updateQueue],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAnimationFrame(frame.current);
      animation.current?.cancel();
    };
  }, []);
  useEffect(() => {
    const version = ++generation.current;
    updateQueue([]);
    setExhausted(false);
    setFeedError("");
    // Serialize queue requests so an initial anonymous cookie cannot be
    // replaced by a competing response during a quick category change.
    void fill(category, version);
  }, [category, fill, updateQueue]);
  useEffect(() => {
    if (cards.length <= 5 && !fetching && !exhausted && !feedError)
      void fill(category, generation.current);
  }, [cards.length, fetching, exhausted, feedError, category, fill]);

  const deckAd = placements.find((p) => p.position === "deck");
  const showAd = !!deckAd && count > 0 && count % 6 === 0 && adAfter < count;
  const continueAd = useCallback(() => setAdAfter(count), [count]);
  const impression = useCallback((card: Card, week: Season) => {
    const key = `${week.id}:${card.id}`;
    let request = seen.current.get(key);
    if (!request) {
      request = api(
        "feed/impression",
        {
          companyId: card.id,
          seasonId: week.id,
          source: trafficSource(),
        },
        { keepalive: true },
      );
      seen.current.set(key, request);
      void request.catch(() => seen.current.delete(key));
    }
    return request;
  }, []);
  useEffect(() => {
    const record = () => {
      if (
        current &&
        season &&
        !showAd &&
        document.visibilityState === "visible"
      ) {
        viewed(current.id);
        void impression(current, season).catch(() => {});
      }
    };
    record();
    document.addEventListener("visibilitychange", record);
    return () => document.removeEventListener("visibilitychange", record);
  }, [current, season, impression, showAd, viewed]);
  useEffect(() => {
    if (failed && !dialog.current?.open) dialog.current?.showModal();
    if (!failed && dialog.current?.open) dialog.current.close();
  }, [failed]);

  const save = useCallback(
    async (action: Action, challengeToken?: string) => {
      inFlight.current.add(action.card.id);
      setPending(inFlight.current.size);
      try {
        // Start the mutation immediately. It records its visible impression
        // atomically if the separate exposure request is still in flight.
        void impression(action.card, action.season).catch(() => {});
        const result = await api<{
          rank: number;
          total_points: number;
          valid: boolean;
        }>(
          action.back ? "back" : "skip",
          {
            companyId: action.card.id,
            seasonId: action.season.id,
            surface: "feed",
            source: trafficSource(),
            turnstileToken: challengeToken,
          },
          { keepalive: true },
        );
        if (!mounted.current) return;
        if (action.back && result.valid) setBacks((n) => n + 1);
        setFeedback({
          title: action.back
            ? result.valid
              ? `${action.card.name} backed. +1 COMMUNITY BACKING`
              : `${action.card.name}: Back received for review.`
            : `Passed ${action.card.name}.`,
          detail: action.back
            ? `#${result.rank} this week · ${money(result.total_points)} total backing`
            : "There’s another good idea waiting.",
        });
      } catch (e) {
        if (!mounted.current) return;
        // A timeout may follow a committed action. A retry's 409 is confirmation,
        // never a reason to invent a second point or restore it optimistically.
        if (e instanceof ApiError && e.message.includes("already backed")) {
          setFeedback({
            title: `${action.card.name} already has your Back.`,
            detail: "One Back per company, each week.",
          });
          return;
        }
        setFailed({
          ...action,
          message: (e as Error).message,
          challenge: e instanceof ApiError && e.code === "CHALLENGE_REQUIRED",
          seasonChanged: e instanceof ApiError && e.code === "SEASON_CHANGED",
        });
        throw e;
      } finally {
        inFlight.current.delete(action.card.id);
        if (mounted.current) setPending(inFlight.current.size);
      }
    },
    [impression, setFailed],
  );

  const act = useCallback(
    (back: boolean, keyboard = false) => {
      const card = queue.current[0];
      const week = activeSeason.current;
      if (
        !card ||
        !week ||
        blocked.current ||
        failed ||
        inFlight.current.size >= 6
      )
        return;
      blocked.current = true;
      setAnimating(true);
      gesture.current = null;
      cancelAnimationFrame(frame.current);
      dismissed.current.add(card.id);
      setFeedback({
        title: back
          ? `Sending your Back for ${card.name}…`
          : `Passing ${card.name}…`,
        pending: true,
      });
      void save({ card, back, season: week }).catch(() => {});
      const finish = () => {
        if (!mounted.current) return;
        stage.current
          ?.querySelectorAll<HTMLElement>(".queued-card")
          .forEach((node) => {
            node.style.transform = "";
          });
        updateQueue(queue.current.filter((c) => c.id !== card.id));
        setCount((n) => n + 1);
        blocked.current = false;
        setAnimating(false);
        animation.current = null;
      };
      const node = stage.current?.querySelector<HTMLElement>(
        '[data-active="true"]',
      );
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!node || keyboard || reduce) {
        setInstant(true);
        finish();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => mounted.current && setInstant(false)),
        );
        return;
      }
      node.classList.remove("is-dragging");
      const stamp = node.querySelector<HTMLElement>(
        back ? ".stamp-back" : ".stamp-pass",
      );
      if (stamp) stamp.style.opacity = "1";
      const direction = back ? 1 : -1;
      animation.current = node.animate(
        [
          { transform: getComputedStyle(node).transform, opacity: 1 },
          {
            transform: `translate3d(${direction * (window.innerWidth + node.offsetWidth)}px, -35px, 0) rotate(${direction * 22}deg)`,
            opacity: 0.7,
          },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(.32,.72,0,1)",
          fill: "forwards",
        },
      );
      animation.current.onfinish = finish;
    },
    [failed, save, updateQueue],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest("input,textarea,select,dialog") ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (e.code === "Space" && (e.target as HTMLElement).closest("button,a"))
        return;
      if (["ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
        if (showAd) continueAd();
        else act(e.code !== "ArrowLeft", true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [act, showAd, continueAd]);

  function resetDrag(node: HTMLElement) {
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    node.classList.remove("is-dragging");
    node.style.transform = "";
    node
      .querySelectorAll<HTMLElement>(".swipe-stamp")
      .forEach((s) => (s.style.opacity = "0"));
    const underneath =
      stage.current?.querySelector<HTMLElement>('[data-depth="1"]');
    if (underneath) underneath.style.transform = "";
  }
  function pointerDown(e: PointerEvent<HTMLElement>) {
    if (
      blocked.current ||
      failed ||
      e.button !== 0 ||
      (e.target as HTMLElement).closest("a,button")
    )
      return;
    gesture.current = {
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      dx: 0,
      dy: 0,
      lastX: e.clientX,
      lastTime: performance.now(),
      velocity: 0,
      axis: null,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: PointerEvent<HTMLElement>) {
    const drag = gesture.current;
    if (!drag || drag.pointer !== e.pointerId || blocked.current) return;
    const now = performance.now();
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
    if (!drag.axis && Math.max(Math.abs(drag.dx), Math.abs(drag.dy)) > 8)
      drag.axis = Math.abs(drag.dx) > Math.abs(drag.dy) ? "x" : "y";
    drag.velocity = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastTime);
    drag.lastX = e.clientX;
    drag.lastTime = now;
    if (drag.axis !== "x") return;
    const node = e.currentTarget;
    node.classList.add("is-dragging");
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      node.style.transform = `translate3d(${drag.dx}px, ${drag.dy * 0.12}px, 0) rotate(${Math.max(-16, Math.min(16, drag.dx / 22))}deg)`;
      const progress = Math.min(1, Math.abs(drag.dx) / 110);
      const backStamp = node.querySelector<HTMLElement>(".stamp-back");
      const passStamp = node.querySelector<HTMLElement>(".stamp-pass");
      if (backStamp)
        backStamp.style.opacity = drag.dx > 0 ? String(progress) : "0";
      if (passStamp)
        passStamp.style.opacity = drag.dx < 0 ? String(progress) : "0";
      const underneath =
        stage.current?.querySelector<HTMLElement>('[data-depth="1"]');
      if (underneath)
        underneath.style.transform = `translate3d(0,${10 * (1 - progress)}px,0) scale(${0.955 + progress * 0.045})`;
    });
  }
  function pointerUp(e: PointerEvent<HTMLElement>) {
    const drag = gesture.current;
    if (!drag || drag.pointer !== e.pointerId) return;
    const threshold = Math.min(110, e.currentTarget.offsetWidth * 0.24);
    const flick =
      Math.abs(drag.dx) > 30 &&
      Math.abs(drag.velocity) > 0.55 &&
      performance.now() - drag.lastTime < 100;
    if (drag.axis === "x" && (Math.abs(drag.dx) > threshold || flick))
      act(drag.dx > 0);
    else resetDrag(e.currentTarget);
  }
  function sponsor(position: string) {
    const placement = placements.find(
      (p) => p.position === position || p.position === "both",
    );
    return placement ? (
      <Advertisement
        placement={placement}
        surface={position as "top" | "bottom"}
        category={category}
      />
    ) : (
      <Link
        className={`deck-sponsor vacant sponsor-${position}`}
        href="/advertise"
      >
        <span>YOUR BRAND HERE</span>
        <span className="sponsor-copy">
          Back the good side of the internet.
        </span>
        <ArrowUpRight size={14} />
      </Link>
    );
  }
  const disabled = !current || animating || !!failed || pending >= 6;
  return (
    <div className="swipe-world">
      <aside className="swipe-editorial" aria-label="How discovery works">
        <span className="eyebrow">
          <span className="live-dot" /> SMALL COMPANIES. BIG IDEAS.
        </span>
        <h1>
          Your next
          <br />
          favorite is
          <br />a <span>swipe away.</span>
        </h1>
        <p>
          The internet has good taste.
          <br />
          Let’s give it a little backing.
        </p>
        <div className="swipe-instructions">
          <div>
            <span className="instruction-icon pass">
              <X size={17} />
            </span>
            <div>
              <strong>Not your thing?</strong>
              <span>Swipe left to pass.</span>
            </div>
          </div>
          <div>
            <span className="instruction-icon support">
              <Plus size={18} />
            </span>
            <div>
              <strong>Into it?</strong>
              <span>Swipe right to give it a Back.</span>
            </div>
          </div>
        </div>
        <div className="swipe-session">
          <span className="mono">YOUR LITTLE DISCOVERY SESSION</span>
          <div>
            <strong>{String(count).padStart(2, "0")}</strong>
            <span>discovered</span>
            <i />
            <strong>{String(backs).padStart(2, "0")}</strong>
            <span>backed</span>
          </div>
        </div>
        <Link className="swipe-rules" href="/rules">
          <Info size={15} /> Every company gets a fair shot{" "}
          <ArrowUpRight size={13} />
        </Link>
      </aside>
      <section className="swipe-center" aria-label="Discover companies">
        <h1 className="swipe-mobile-title">
          Your next favorite is a swipe away.
        </h1>
        <div className="swipe-topline">
          <span>
            <Compass size={16} /> THE DISCOVERY DECK
          </span>
          <span className="mono">
            <span className="live-dot" /> A FRESH STACK EVERY WEEK
          </span>
        </div>
        <CategoryFilter
          value={category}
          onChange={setCategory}
          allLabel="For you"
          variant="swipe-category-filter"
          disabled={animating || !!failed}
        />
        {sponsor("top")}
        <div className="swipe-stage deck" ref={stage} data-instant={instant}>
          {showAd && deckAd && (
            <Advertisement
              key={`${deckAd.id}:${count}`}
              placement={deckAd}
              surface="deck"
              category={category}
              onContinue={continueAd}
            />
          )}
          {cards.slice(0, 3).map((card, index) => (
            <article
              key={card.id}
              className={`discovery-card swipe-card ${index === 0 ? "active-card" : "queued-card"}`}
              data-active={index === 0}
              data-depth={index}
              style={{ "--deck-depth": index } as React.CSSProperties}
              aria-hidden={index !== 0 || showAd}
              inert={index !== 0 || showAd}
              onPointerDown={index === 0 ? pointerDown : undefined}
              onPointerMove={index === 0 ? pointerMove : undefined}
              onPointerUp={index === 0 ? pointerUp : undefined}
              onPointerCancel={
                index === 0 ? (e) => resetDrag(e.currentTarget) : undefined
              }
            >
              <div className="card-visual">
                <img
                  src={card.hero_image_url}
                  alt={`${card.name} product preview`}
                  draggable={false}
                  fetchPriority={index === 0 ? "high" : "low"}
                />
                <span className="visual-label">{card.category}</span>
                {card.is_demo && (
                  <span className="demo-label">Staging demo</span>
                )}
                <span className="visual-discovery-label">
                  <Sparkles size={13} /> FOUND ON BACKING
                </span>
              </div>
              <div className="card-content">
                <div className="card-company">
                  <Logo src={card.logo_url} name={card.name} size={48} />
                  <div>
                    <h2>
                      {card.name}
                      {card.verification_status === "verified" && (
                        <Check className="verified" size={17} />
                      )}
                    </h2>
                    <span>{new URL(card.url).hostname}</span>
                  </div>
                  <Link
                    href={`/company/${card.slug}`}
                    className="icon-button"
                    aria-label={`View ${card.name} profile`}
                  >
                    <ArrowUpRight size={21} />
                  </Link>
                </div>
                <p className="card-tagline">
                  {card.what_it_does || card.tagline}
                </p>
                <div className="swipe-company-info">
                  <span>
                    {card.target_audience
                      ? `For ${card.target_audience}`
                      : card.category}
                  </span>
                  <span>{pricingLabels[card.pricing_model]}</span>
                </div>
                <div className="card-bottom">
                  <SaveButton company={card} compact />
                  <Visit company={card} />
                </div>
              </div>
              <div className="swipe-stamp stamp-back" aria-hidden="true">
                BACK <Plus size={24} />
              </div>
              <div className="swipe-stamp stamp-pass" aria-hidden="true">
                PASS <X size={24} />
              </div>
            </article>
          ))}
          {!current && (
            <div className="discovery-card swipe-placeholder">
              {fetching || (!exhausted && !feedError) ? (
                <>
                  <Spinner />
                  <h2>Your next favorite is on its way.</h2>
                  <p>Finding something worth a Back…</p>
                </>
              ) : (
                <>
                  <Empty
                    title={
                      feedError
                        ? "Let’s give that another try."
                        : "You’ve seen the whole stack."
                    }
                  >
                    {feedError ||
                      "Good taste. Switch categories or see how your favorites are doing."}
                  </Empty>
                  {feedError ? (
                    <button
                      className="button"
                      onClick={() => void fill(category, generation.current)}
                    >
                      Try again
                    </button>
                  ) : (
                    <Link className="button" href="/leaderboard">
                      See the leaderboard <ArrowRight size={16} />
                    </Link>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {showAd ? (
          <div className="sponsored-controls">
            <button className="button" onClick={continueAd}>
              Continue discovering <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <div className="swipe-controls">
            <div className="control-item">
              <button
                className="round-action skip-action"
                aria-label="Skip"
                onClick={(e) =>
                  showAd ? continueAd() : act(false, e.detail === 0)
                }
                disabled={disabled}
              >
                <X size={31} strokeWidth={1.8} />
              </button>
              <span>
                PASS <kbd>←</kbd>
              </span>
            </div>
            <div className="control-item primary">
              <button
                className="round-action back-action"
                aria-label={showAd ? "Continue discovering" : "Back +1"}
                onClick={(e) =>
                  showAd ? continueAd() : act(true, e.detail === 0)
                }
                disabled={disabled}
              >
                <Plus size={38} strokeWidth={2} />
                <span className="round-point">+1</span>
              </button>
              <span>
                BACK <kbd>→</kbd>
              </span>
            </div>
            <div className="control-item">
              {current ? (
                <Link
                  href={`/company/${current.slug}`}
                  className="round-action detail-action"
                  aria-label={`More about ${current.name}`}
                >
                  <Info size={24} strokeWidth={1.7} />
                </Link>
              ) : (
                <span className="round-action detail-action disabled">
                  <Info size={24} />
                </span>
              )}
              <span>DETAILS</span>
            </div>
          </div>
        )}
        <div
          className="swipe-feedback"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>
            {feedback?.pending ? (
              <span className="saving-dot" />
            ) : feedback ? (
              <Check size={13} />
            ) : (
              <span className="live-dot" />
            )}
            {feedback?.title || "Swipe or tap. No account needed."}
          </span>
          {feedback?.detail && <small>{feedback.detail}</small>}
        </div>
        {sponsor("bottom")}
      </section>
      <aside
        className="swipe-week"
        aria-label="Weekly leaderboard and founders"
      >
        <div className="week-art" aria-hidden="true">
          <Asterisk strokeWidth={1.2} />
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="orbit-dot" />
        </div>
        <span className="eyebrow">A LITTLE BACKING GOES A LONG WAY</span>
        <h2>
          Good things
          <br />
          deserve to
          <br />
          be found.
        </h2>
        <p>
          Your Back is one point.
          <br />A fresh leaderboard, every week.
        </p>
        <Link href="/leaderboard" className="week-board-link">
          This week’s leaderboard <ArrowRight size={18} />
        </Link>
        <div className="week-reset">
          <span className="live-dot" /> NEXT FRESH START
          {season && <Countdown ends={season.ends_at} />}
        </div>
        <Link href="/submit" className="swipe-submit">
          <Plus size={19} />
          <span>
            Making something good?<strong>Put it in the stack.</strong>
          </span>
          <ArrowUpRight size={16} />
        </Link>
        <div className="swipe-small-links">
          <Link href="/about">The idea</Link>
          <Link href="/advertise">Advertise</Link>
          <Link href="/dashboard">For founders</Link>
        </div>
      </aside>
      <dialog
        className="swipe-retry-dialog"
        aria-labelledby="swipe-retry-title"
        aria-describedby="swipe-retry-description"
        ref={dialog}
        onCancel={(event) => {
          if (retrying || animating) {
            event.preventDefault();
            return;
          }
          if (failed && !retrying) {
            dismissed.current.delete(failed.card.id);
            updateQueue([
              failed.card,
              ...queue.current.filter((c) => c.id !== failed.card.id),
            ]);
            setFailed(undefined);
            setToken(undefined);
          }
        }}
      >
        {failed && (
          <>
            <span className="eyebrow">
              YOUR {failed.back ? "BACK" : "PASS"} HASN’T BEEN CONFIRMED
            </span>
            <h2 id="swipe-retry-title">{failed.card.name}</h2>
            <p id="swipe-retry-description">{failed.message}</p>
            {failed.challenge && <Challenge onToken={setToken} />}
            <div>
              <button
                className="button green"
                disabled={retrying || (failed.challenge && !token)}
                onClick={() => {
                  if (failed.seasonChanged) {
                    window.location.reload();
                    return;
                  }
                  setRetrying(true);
                  setToken(undefined);
                  void save(failed, token)
                    .then(() => setFailed(undefined))
                    .catch(() => {})
                    .finally(() => setRetrying(false));
                }}
              >
                {retrying
                  ? "Saving…"
                  : failed.seasonChanged
                    ? "Refresh stack"
                    : "Try again"}
              </button>
              <button
                className="button"
                disabled={retrying || animating}
                onClick={() => {
                  dismissed.current.delete(failed.card.id);
                  updateQueue([
                    failed.card,
                    ...queue.current.filter((c) => c.id !== failed.card.id),
                  ]);
                  setFailed(undefined);
                  setToken(undefined);
                  setFeedback({
                    title:
                      "Your last action wasn’t saved. The card is back in your deck.",
                  });
                }}
              >
                Return to card
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
