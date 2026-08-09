"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

/**
 * What is open in the browse aside.
 *
 * Deliberately knows nothing about spells. It takes a key and a thunk that
 * resolves to a rendered node, so the type being browsed supplies its own
 * loader and monsters or items reuse this untouched.
 */

/** Resolves to the aside's body. In practice a bound server function. */
type Loader = () => Promise<ReactNode>;

interface AsideApi {
  /** Identifies what is open; also what marks a row as selected. */
  openKey: string | null;
  node: ReactNode;
  /** True between the click and the reply. */
  pending: boolean;
  open: (key: string, load: Loader) => void;
  close: () => void;
}

const AsideContext = createContext<AsideApi | null>(null);

export function useAside(): AsideApi {
  const value = useContext(AsideContext);
  if (!value) {
    throw new Error("useAside must be used inside an <AsideProvider>");
  }
  return value;
}

export function AsideProvider({ children }: { children: ReactNode }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [node, setNode] = useState<ReactNode>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Nodes already fetched, so going back to something read a moment ago costs
   * nothing. This replaces what the router cache did for free while the aside
   * was a route. Unbounded on purpose: entries are dropped when the list
   * unmounts, and a browse session opens tens of rows, not thousands.
   */
  const cache = useRef(new Map<string, ReactNode>());

  /** The most recent request, so a slow reply cannot overwrite a newer one. */
  const requested = useRef<string | null>(null);

  const close = useCallback(() => {
    requested.current = null;
    setOpenKey(null);
    setNode(null);
  }, []);

  const open = useCallback((key: string, load: Loader) => {
    if (requested.current === key) return;
    requested.current = key;
    setOpenKey(key);

    const cached = cache.current.get(key);
    if (cached) {
      setNode(cached);
      return;
    }

    // Clears the previous spell immediately, so the panel never shows one
    // entity under another's heading while the next is in flight.
    setNode(null);

    startTransition(async () => {
      const loaded = await load();
      cache.current.set(key, loaded);
      // Clicking three rows quickly can resolve out of order. The last click
      // wins, whichever reply lands last.
      if (requested.current === key) setNode(loaded);
    });
  }, []);

  useEffect(() => {
    if (!openKey) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openKey, close]);

  /**
   * Leaving the list closes the aside.
   *
   * The section's layout is shared with each entity's own page, so this
   * provider survives a navigation onto one — and "Open full page" would
   * otherwise land on the full spell with the aside still stacked beside it,
   * showing the same spell twice. The intercepting route got this for free from
   * its `default.tsx`; as client state it has to be said.
   *
   * Keyed on the path alone, so filtering and sorting — which only ever move
   * the query string — leave what you are reading where it is.
   *
   * Adjusted during render rather than in an effect. React re-runs this
   * component before committing, so the aside never paints over the new page
   * for a frame the way an effect would let it.
   */
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpenKey(null);
    setNode(null);
  }

  // The guard is a ref, which may not be written during render, so it is
  // cleared once the navigation commits — without it the row just closed would
  // refuse to open again on coming back to the list.
  useEffect(() => {
    requested.current = null;
  }, [pathname]);

  const value = useMemo(
    () => ({ openKey, node, pending, open, close }),
    [openKey, node, pending, open, close],
  );

  return (
    <AsideContext.Provider value={value}>{children}</AsideContext.Provider>
  );
}
