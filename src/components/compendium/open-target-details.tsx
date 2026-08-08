"use client";

import { useEffect } from "react";

/**
 * Open whichever `<details>` the URL fragment points into.
 *
 * Browsers already do this for a **cold** arrival: navigating to
 * `…/dwarf#hill` expands the closed `<details>` containing `#hill` and scrolls
 * to it, no script involved. They do **not** do it for a **same-document** hash
 * change — measured, not assumed — which is exactly what clicking the outline
 * on this page is. Without this, the outline would jump to a collapsed section
 * and appear to do nothing.
 *
 * Progressive enhancement, so it stays honest if the script never runs: cold
 * deep links still work natively, and the summaries are still clickable. All
 * this adds is the same behaviour for in-page jumps and for browsers that have
 * not shipped the native version.
 */
export function OpenTargetDetails() {
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;

      const target = document.getElementById(id);
      const details = target?.closest("details");
      if (!details || details.open) return;

      details.open = true;
      // Expand first, then aim: scrolling at collapsed height lands short.
      requestAnimationFrame(() => target?.scrollIntoView({ block: "start" }));
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return null;
}
