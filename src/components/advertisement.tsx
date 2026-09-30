"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { api, trafficSource } from "./ui";
export type Placement = {
  id: string;
  advertiser: string;
  creative: string;
  description: string;
  destination_url: string;
  position: string;
  logo_url: string;
  hero_image_url: string;
  cta_label: string;
  is_demo: boolean;
  ends_at: string;
};
export function usePlacements() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  useEffect(() => {
    let mounted = true;
    const refresh = () =>
      void api<{ placements: Placement[] }>("placements")
        .then((data) => {
          if (mounted) setPlacements(data.placements);
        })
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);
  return placements;
}
export function Advertisement({
  placement,
  surface,
  category = "All",
  onContinue,
}: {
  placement: Placement;
  surface: "deck" | "browse" | "top" | "bottom";
  category?: string;
  onContinue?: () => void;
}) {
  const node = useRef<HTMLElement>(null);
  const identity = useRef<{ key: string; id: string } | null>(null);
  const [exposure, setExposure] = useState("");
  const [source, setSource] = useState("direct");
  useEffect(() => {
    if (!node.current) return;
    const contextKey = `${placement.id}:${surface}:${category}`;
    if (identity.current?.key !== contextKey)
      identity.current = { key: contextKey, id: crypto.randomUUID() };
    const exposureId = identity.current.id;
    const origin = trafficSource();
    setExposure("");
    setSource(origin);
    const body = {
      exposureId,
      placementId: placement.id,
      surface,
      category,
      source: origin,
    };
    // Count actual rendering, never inventory fetching or preloading.
    const served = api("ads/impression", body, { keepalive: true });

    let active = true,
      ready = false,
      visible = false,
      recorded = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const check = () => {
      reset();
      if (
        ready &&
        active &&
        visible &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        !recorded
      )
        timer = setTimeout(() => {
          void served
            .then(() => api("ads/viewable", body, { keepalive: true }))
            .then(() => {
              recorded = true;
            })
            .catch(() => {});
        }, 1100);
    };
    void served
      .then(() => {
        if (active) {
          ready = true;
          setExposure(exposureId);
          check();
        }
      })
      .catch(() => {});
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].intersectionRatio >= 0.5;
        check();
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(node.current);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("blur", check);
    return () => {
      active = false;
      reset();
      observer.disconnect();
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("blur", check);
    };
  }, [placement.id, surface, category]);
  const href = `/api/ads/click?${new URLSearchParams({ placement: placement.id, exposure, surface, category, source })}`;
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(
    null,
  );
  const exitAnimation = useRef<Animation | null>(null);
  useEffect(
    () => () => {
      exitAnimation.current?.cancel();
    },
    [],
  );
  const full = surface === "deck" || surface === "browse";
  return (
    <article
      ref={node}
      className={`advertisement ad-${surface} ${full ? "full-ad" : "banner-ad"}`}
      aria-label={`Sponsored by ${placement.advertiser}`}
      onPointerDown={(e) => {
        if (
          !onContinue ||
          exitAnimation.current ||
          (e.target as HTMLElement).closest("a,button") ||
          !e.isPrimary
        )
          return;
        drag.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const gesture = drag.current;
        gesture.dx = e.clientX - gesture.x;
        gesture.dy = e.clientY - gesture.y;
        if (Math.abs(gesture.dx) > Math.abs(gesture.dy))
          e.currentTarget.style.transform = `translate3d(${gesture.dx}px,${gesture.dy * 0.2}px,0) rotate(${gesture.dx * 0.035}deg)`;
      }}
      onPointerUp={(e) => {
        const gesture = drag.current;
        drag.current = null;
        if (!gesture) return;
        const element = e.currentTarget;
        if (element.hasPointerCapture(e.pointerId))
          element.releasePointerCapture(e.pointerId);
        const commit =
          Math.abs(gesture.dx) > 70 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          element.style.transform = "";
          if (commit) onContinue?.();
          return;
        }
        const animation = element.animate(
          [
            { transform: getComputedStyle(element).transform },
            {
              transform: commit
                ? `translate3d(${Math.sign(gesture.dx) * (innerWidth + element.offsetWidth)}px,0,0) rotate(${Math.sign(gesture.dx) * 22}deg)`
                : "translate3d(0,0,0)",
            },
          ],
          {
            duration: commit ? 220 : 160,
            easing: "cubic-bezier(.32,.72,0,1)",
            fill: "forwards",
          },
        );
        exitAnimation.current = animation;
        animation.onfinish = () => {
          element.style.transform = "";
          animation.cancel();
          exitAnimation.current = null;
          if (commit) onContinue?.();
        };
      }}
      onPointerCancel={(e) => {
        drag.current = null;
        e.currentTarget.style.transform = "";
      }}
    >
      <div className="ad-label">
        <span>SPONSORED</span>
        {placement.is_demo && <span>STAGING PREVIEW · UNPAID</span>}
      </div>
      {full && placement.hero_image_url && (
        <img
          className="ad-hero"
          src={placement.hero_image_url}
          alt={`${placement.advertiser} sponsor preview`}
          draggable={false}
        />
      )}
      <div className="ad-body">
        {placement.logo_url && (
          <img className="ad-logo" src={placement.logo_url} alt="" />
        )}
        <span className="ad-advertiser">{placement.advertiser}</span>
        <h2>{placement.creative}</h2>
        {full && <p>{placement.description}</p>}
        <a
          className="button ad-cta"
          href={exposure ? href : undefined}
          aria-disabled={!exposure}
          target="_blank"
          rel="noopener noreferrer sponsored"
        >
          {placement.cta_label || "Visit sponsor"} <ArrowUpRight size={16} />
        </a>
        {onContinue && (
          <button className="ad-continue" onClick={onContinue}>
            <X size={16} /> Continue discovering
          </button>
        )}
      </div>
      {surface === "deck" && (
        <p className="ad-disclosure">
          {placement.is_demo ? "Preview placement" : "Paid placement"} · Swipe
          either way to continue · No leaderboard points
        </p>
      )}
    </article>
  );
}
