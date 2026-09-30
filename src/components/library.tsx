"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Bookmark, Check } from "lucide-react";
import { tagLabel } from "@/lib/taxonomy";
import { pricingLabels } from "@/lib/validation";
import type { Company } from "@/lib/leaderboard";

export type Mode = "swipe" | "browse" | "saved" | "recent";
type Library = { mode: Mode; saved: string[]; recent: string[] };
const initial: Library = { mode: "swipe", saved: [], recent: [] };
const key = "backing-library-v1";
const modes: Mode[] = ["swipe", "browse", "saved", "recent"];
function parse(raw: string | null): Library {
  try {
    const value = JSON.parse(raw || "{}");
    const ids = (list: unknown, max: number) =>
      Array.isArray(list)
        ? [
            ...new Set(
              list.filter(
                (id): id is string =>
                  typeof id === "string" &&
                  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
                    id,
                  ),
              ),
            ),
          ].slice(0, max)
        : [];
    return {
      mode: modes.includes(value.mode) ? value.mode : "swipe",
      saved: ids(value.saved, 100),
      recent: ids(value.recent, 50),
    };
  } catch {
    return initial;
  }
}
type LibraryContext = Library & {
  ready: boolean;
  storageError: boolean;
  setMode: (mode: Mode) => void;
  toggle: (id: string) => void;
  viewed: (id: string) => void;
  clear: (collection: "saved" | "recent") => void;
};
const Context = createContext<LibraryContext | null>(null);
export function LibraryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(initial);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      setData(parse(localStorage.getItem(key)));
    } catch {
      setStorageError(true);
    }
    setReady(true);
    const update = (e: StorageEvent) => {
      if (e.key === key) setData(parse(e.newValue));
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        setStorageError(true);
      }
    }
  }, [data, ready]);
  const setMode = useCallback(
    (mode: Mode) => setData((d) => ({ ...d, mode })),
    [],
  );
  const toggle = useCallback(
    (id: string) =>
      setData((d) => ({
        ...d,
        saved: d.saved.includes(id)
          ? d.saved.filter((x) => x !== id)
          : [id, ...d.saved].slice(0, 100),
      })),
    [],
  );
  const viewed = useCallback(
    (id: string) =>
      setData((d) =>
        d.recent[0] === id
          ? d
          : {
              ...d,
              recent: [id, ...d.recent.filter((x) => x !== id)].slice(0, 50),
            },
      ),
    [],
  );
  const clear = useCallback(
    (collection: "saved" | "recent") =>
      setData((d) => ({ ...d, [collection]: [] })),
    [],
  );
  return (
    <Context
      value={{ ...data, ready, storageError, setMode, toggle, viewed, clear }}
    >
      {children}
    </Context>
  );
}
export const useLibrary = () => {
  const library = useContext(Context);
  if (!library) throw new Error("LibraryProvider is required");
  return library;
};
export function SaveButton({
  company,
  compact = false,
}: {
  company: { id: string; name: string };
  compact?: boolean;
}) {
  const { saved, toggle, ready } = useLibrary();
  const selected = saved.includes(company.id);
  return (
    <button
      type="button"
      className={compact ? "icon-button save-company" : "button save-company"}
      disabled={!ready}
      aria-pressed={selected}
      aria-label={`${selected ? "Unsave" : "Save"} ${company.name}`}
      onClick={() => toggle(company.id)}
    >
      {selected ? <Check size={17} /> : <Bookmark size={17} />}{" "}
      {!compact && (selected ? "Saved" : "Save for later")}
    </button>
  );
}
export function CompanyFacts({
  company,
}: {
  company: Pick<
    Company,
    | "what_it_does"
    | "target_audience"
    | "pricing_model"
    | "pricing_note"
    | "tags"
  >;
}) {
  return (
    <div className="company-facts">
      {company.what_it_does && (
        <div>
          <span>WHAT IT DOES</span>
          <p>{company.what_it_does}</p>
        </div>
      )}
      {company.target_audience && (
        <div>
          <span>MADE FOR</span>
          <p>{company.target_audience}</p>
        </div>
      )}
      <div>
        <span>PRICING</span>
        <p>
          {pricingLabels[company.pricing_model] || pricingLabels.unknown}
          {company.pricing_note && ` · ${company.pricing_note}`}
        </p>
      </div>
      {company.tags?.length > 0 && (
        <div className="useful-tags">
          {company.tags.map((tag) => (
            <span key={tag}>{tagLabel(tag)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
