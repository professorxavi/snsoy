"use client";

import { useEffect } from "react";

/**
 * Puts the reader where the URL fragment says, on a page the browser could not.
 *
 * Every reading route streams a `loading.tsx` fallback, and the browser performs
 * its fragment scroll against *that* — measured 2026-08-10 on
 * `/compendium/races/phb/dwarf#hill`, the target resolves at ~145ms while the
 * document is 726px tall, and the real 4,663px body swaps in at ~373ms. Whatever
 * scroll the browser managed is lost by then: a wizard subclass landed 8,277px
 * above where it belonged and a chapter section 9,573px.
 *
 * So this runs after the real body has mounted, which is the whole point of
 * rendering it inside the page rather than beside the fallback.
 *
 * Two things, in order. A `<details>` around the target is opened, since the
 * browser only expands one when its own fragment handling ran and reached the
 * contents. Then the target is scrolled to **unconditionally** — the version of
 * this that lived in the subrace list returned early when the disclosure was
 * already open, which made a deep link into a subrace a coin flip on whether
 * the browser or this effect got there first.
 *
 * Progressive enhancement: a cold arrival, the summaries and the outline links
 * all still work if the script never runs.
 */
export function FragmentTarget() {
  useEffect(() => {
    const apply = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;

      const target = document.getElementById(id);
      if (!target) return;

      const details = target.closest("details");
      if (details && !details.open) details.open = true;

      // A frame, so an expanded disclosure is measured at its open height
      // rather than the collapsed one it had when this ran.
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    };

    apply();

    // Same-document hash changes — clicking the outline — are not navigations,
    // so nothing else would open the section they point into.
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  return null;
}
