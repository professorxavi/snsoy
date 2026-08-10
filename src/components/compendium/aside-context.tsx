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

type Loader = () => Promise<ReactNode>;

interface StackEntry {
  key: string;
  /** What to call it on the back button. The text of the link that opened it. */
  label?: string;
}

interface AsideApi {
  openKey: string | null;
  node: ReactNode;
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

  /**
   * What is already open or on its way, so clicking the same row twice does not
   * refetch it. Dedupe only — see `seq` for the part that decides which reply
   * is allowed to land.
   */
  const requested = useRef<string | null>(null);

  /**
   * Ticket for the newest request. A reply sets the panel only if its ticket is
   * still the current one.
   *
   * Separate from `requested` because the two answer different questions, and
   * one ref answering both was a bug: `requested` is cleared whenever the page
   * navigates, and while it was also the stale-response guard, that clearing
   * threw away a reply that was legitimately in flight. Effects run children
   * first, so anything opening the aside *as a page arrives* — the typeahead's
   * chosen entity, through `AsideAutoOpen` — set the guard microseconds before
   * the navigation reset cleared it, and the panel then sat on its skeleton for
   * ever. A counter nothing else touches cannot be caught by that.
   */
  const seq = useRef(0);

  const openKey = stack.length > 0 ? stack[stack.length - 1]!.key : null;
  const previous = stack.length > 1 ? stack[stack.length - 2]! : null;

  const close = useCallback(() => {
    requested.current = null;
    // Nothing still in flight may populate a panel the reader has closed.
    seq.current += 1;
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
      seq.current += 1;
      setNode(cached);
      return;
    }

    // Clears the previous entity immediately, so the panel never shows one
    // body under another's heading while the next is in flight.
    setNode(null);

    const ticket = (seq.current += 1);

    startTransition(async () => {
      const loaded = await load();
      cache.current.set(key, loaded);
      // Clicking three references quickly can resolve out of order. The last
      // click wins, whichever reply lands last.
      if (seq.current === ticket) setNode(loaded);
    });
  }, []);

  const back = useCallback(() => {
    if (!previous) return;
    requested.current = previous.key;
    seq.current += 1;
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

  /*
   * The dedupe guard is a ref, which may not be written during render, so it is
   * cleared once the navigation commits — without it the entity just closed
   * would refuse to open again on coming back.
   *
   * Safe to run after a child has already opened something, which it does: this
   * clears only the dedupe, and the reply in flight is protected by its ticket.
   */
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
