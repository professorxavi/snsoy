"use client";

import { Box } from "@chakra-ui/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ASIDE_OPEN_ATTR } from "@/lib/aside";

/**
 * The navigation progress bar: a rule along the bottom edge of the top bar,
 * shown while a click is waiting on the server.
 *
 * The App Router does not repaint on click. It asks the server for the next
 * page and leaves the current one exactly as it was until the reply lands, so
 * without this a chapter — the slowest page here, and the one people click most
 * — looks like it ignored them. `loading.tsx` answers that for the routes whose
 * whole body is being replaced anyway; this answers it everywhere else, and
 * costs the page nothing while it waits.
 *
 * Drawn in the chrome's own ink rather than the cross-reference cyan: this is
 * the app speaking about itself, not a link into the books.
 */

/** How long a navigation may take before it is worth mentioning. */
const GRACE_MS = 140;
/** How often the creep advances and the URL is re-read. */
const TICK_MS = 60;
/** Where the creep stops. The last tenth belongs to the arrival. */
const CEILING = 90;
/** How long the filled bar holds before clearing, so it is seen to land. */
const SETTLE_MS = 220;
/** A navigation that never arrives. Releases the bar rather than pinning it. */
const ABANDON_MS = 15_000;

export function RouteProgress() {
  /** Percent filled, or null when there is nothing to say. */
  const [value, setValue] = useState<number | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  }, []);

  const later = useCallback((run: () => void, ms: number) => {
    timers.current.push(setTimeout(run, ms));
  }, []);

  /** Fill and fade, so an arrival reads as one rather than as a disappearance. */
  const finish = useCallback(() => {
    clearTimers();
    setValue((current) => (current === null ? null : 100));
    later(() => setValue(null), SETTLE_MS);
  }, [clearTimers, later]);

  const start = useCallback(() => {
    clearTimers();

    /*
     * The URL as it was at the click. The router rewrites it when the
     * navigation commits — on the reply for a blocking route, immediately for
     * one with a `loading.tsx` — so watching it is watching for the arrival,
     * and needs no router event API to do it.
     *
     * `useSearchParams` would report the same thing more directly and is not
     * an option: this component sits in the root layout, and reading search
     * params there opts every page in the app out of static rendering.
     */
    const from = window.location.href;
    const clickedAt = Date.now();

    ticker.current = setInterval(() => {
      if (window.location.href !== from) {
        finish();
        return;
      }
      // Nothing is drawn until the wait is long enough to be worth reporting.
      // Most navigations land inside the grace period and never show a bar,
      // which is the point: a flash is worse than the stillness it replaces.
      if (Date.now() - clickedAt < GRACE_MS) return;

      setValue((current) =>
        current === null
          ? 8
          : Math.min(CEILING, current + Math.max(0.6, (CEILING - current) * 0.1)),
      );
    }, TICK_MS);

    later(finish, ABANDON_MS);
  }, [clearTimers, finish, later]);

  /*
   * Bound on `window` rather than on the document, and in the bubble phase.
   *
   * That is late enough for the aside to have taken the clicks it wants —
   * `AsideLinks` claims a reference in body text during capture and stops it
   * propagating, so those never arrive here at all.
   */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (leadsToANavigation(event)) start();
    };

    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("click", onClick);
      clearTimers();
    };
  }, [start, clearTimers]);

  /**
   * A second arrival signal, for navigations that begin somewhere other than a
   * click on a link — back and forward, or a redirect. Harmless on mount and
   * whenever nothing is running, since finishing an idle bar does nothing.
   */
  const pathname = usePathname();
  useEffect(() => {
    finish();
    // Finishing on every render would cancel the bar it just started, so this
    // deliberately watches the path alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (value === null) return null;

  return (
    /*
     * Hidden from assistive technology on purpose. The App Router already
     * announces route changes through its own live region, and a second
     * announcement on every click would talk over it.
     */
    <Box
      aria-hidden="true"
      position="absolute"
      left="0"
      right="0"
      bottom="0"
      h="2px"
      overflow="hidden"
    >
      <Box
        h="100%"
        bg="brand"
        opacity={value >= 100 ? 0 : 0.85}
        transformOrigin="left"
        transform={`scaleX(${value / 100})`}
        transition="transform .18s ease-out, opacity .2s linear"
      />
    </Box>
  );
}

/**
 * Whether this click is about to cost a page load.
 *
 * Everything excluded here either navigates without the router's help or does
 * not navigate at all, and a bar for any of them would be a lie: a modified or
 * middle click opens a tab, and an in-page hash only scrolls.
 *
 * `defaultPrevented` is deliberately not consulted, and reaching for it is the
 * mistake to avoid here. Every `next/link` cancels its own click before calling
 * the router, so a cancelled click is the normal case rather than the excluded
 * one — skipping them means skipping every navigation in the app. What has to
 * be excluded instead is the one kind of link that cancels a click and then
 * loads nothing, which says so on itself.
 */
export function leadsToANavigation(event: MouseEvent): boolean {
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  const target = event.target;
  const anchor =
    target instanceof Element ? target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  // A browse row. It opens the aside in place, which has a placeholder of its
  // own, and the page under it is not going anywhere.
  if (anchor.hasAttribute(ASIDE_OPEN_ATTR)) return false;

  let next: URL;
  try {
    next = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }

  // Another origin leaves the app entirely; the browser's own indicator has it.
  if (next.origin !== window.location.origin) return false;

  // Same document, different fragment: the outline nav scrolls, it does not
  // fetch. Compared without the hash, which is exactly the part that may differ.
  if (
    next.pathname === window.location.pathname &&
    next.search === window.location.search
  ) {
    return false;
  }

  return true;
}
