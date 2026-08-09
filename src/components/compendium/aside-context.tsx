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
 * What is open in the aside.
 *
 * Deliberately knows nothing about spells or classes. It takes a key and a
 * thunk that resolves to a rendered node, so each caller supplies its own
 * loader and a new content type reuses this untouched.
 */

/** Resolves to the aside's body. In practice a bound server function. */
type Loader = () => Promise<ReactNode>;

/** One level of the reading stack. */
interface StackEntry {
  key: string;
  /** What to call it on the back button. The text of the link that opened it. */
  label?: string;
}

interface AsideApi {
  /** Identifies what is open; also what marks a row as selected. */
  openKey: string | null;
  node: ReactNode;
  /** True between the click and the reply. */
  pending: boolean;
  /** Where back would return to, or null at the bottom of the stack. */
  previous: StackEntry | null;
  open: (key: string, load: Loader, options?: OpenOptions) => void;
  back: () => void;
  close: () => void;
}

interface OpenOptions {
  /** What to call this on the back button of whatever it opens. */
  label?: string;
  /**
   * Stack this on top of what is open rather than replacing it.
   *
   * The difference between going deeper and moving sideways. Following a
   * reference from inside an entity is deeper, and back has to return to what
   * sent you there. Clicking another row in the list, or another link in a
   * chapter, is not — it is a fresh look at a sibling, and stacking those would
   * bury the reader under a back stack as long as their browsing session.
   */
  push?: boolean;
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
  /**
   * The reading stack, innermost last.
   *
   * An entity opened from a chapter is full of references of its own, and
   * following one has to lead somewhere rather than dead-end — so it opens in
   * place too, over the top of what sent you there, and back unwinds it. This
   * is what keeps "everything opens in the aside" from being a trap.
   */
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [node, setNode] = useState<ReactNode>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Nodes already fetched, so going back — or returning to something read a
   * moment ago — costs nothing. Replaces what the router cache did for free
   * while the aside was a route, and is what makes the stack cheap. Unbounded
   * on purpose: it is dropped on navigation, and a session opens tens of
   * entities, not thousands.
   */
  const cache = useRef(new Map<string, ReactNode>());

  /** The most recent request, so a slow reply cannot overwrite a newer one. */
  const requested = useRef<string | null>(null);

  const openKey = stack.length > 0 ? stack[stack.length - 1]!.key : null;
  const previous = stack.length > 1 ? stack[stack.length - 2]! : null;

  const close = useCallback(() => {
    requested.current = null;
    setStack([]);
    setNode(null);
  }, []);

  const open = useCallback((key: string, load: Loader, options?: OpenOptions) => {
    if (requested.current === key) return;
    requested.current = key;

    const entry = { key, label: options?.label };
    setStack((current) => (options?.push ? [...current, entry] : [entry]));

    const cached = cache.current.get(key);
    if (cached) {
      setNode(cached);
      return;
    }

    // Clears the previous entity immediately, so the panel never shows one
    // body under another's heading while the next is in flight.
    setNode(null);

    startTransition(async () => {
      const loaded = await load();
      cache.current.set(key, loaded);
      // Clicking three references quickly can resolve out of order. The last
      // click wins, whichever reply lands last.
      if (requested.current === key) setNode(loaded);
    });
  }, []);

  const back = useCallback(() => {
    if (!previous) return;
    requested.current = previous.key;
    setStack((current) => current.slice(0, -1));
    // Always a hit: nothing reaches the stack without having been cached.
    setNode(cache.current.get(previous.key) ?? null);
  }, [previous]);

  useEffect(() => {
    if (stack.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stack.length, close]);

  /**
   * Leaving the page closes the aside.
   *
   * A section's layout is shared with the pages under it, so this provider
   * survives a navigation onto one — and "Open full page" would otherwise land
   * on the full entity with the aside still stacked beside it, showing the same
   * thing twice.
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
    setStack([]);
    setNode(null);
  }

  // The guard is a ref, which may not be written during render, so it is
  // cleared once the navigation commits — without it the entity just closed
  // would refuse to open again on coming back.
  useEffect(() => {
    requested.current = null;
  }, [pathname]);

  const value = useMemo(
    () => ({ openKey, node, pending, previous, open, back, close }),
    [openKey, node, pending, previous, open, back, close],
  );

  return (
    <AsideContext.Provider value={value}>{children}</AsideContext.Provider>
  );
}
