"use client";
import { useEffect, useRef } from "react";
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      remove: (id: string) => void;
    };
  }
}
export function Challenge({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let widget: string | undefined;
    let disposed = false;
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    const render = () => {
      if (!disposed && ref.current && window.turnstile)
        widget = window.turnstile.render(ref.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          action: "back",
          callback: onToken,
        });
    };
    if (window.turnstile) render();
    else {
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => {
      disposed = true;
      if (widget) window.turnstile?.remove(widget);
    };
  }, [onToken]);
  return <div ref={ref} className="challenge" />;
}
