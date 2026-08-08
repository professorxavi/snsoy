"use client";

import { useEffect } from "react";

/**
 * Opens whichever `<details>` the URL fragment points into.
 *
 * Browsers already do this on a cold arrival, but not on a same-document hash
 * change, which is what clicking the outline is. Without this the outline would
 * jump to a collapsed section and appear to do nothing.
 *
 * Progressive enhancement: cold deep links and the summaries still work if the
 * script never runs.
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
      // Expand before scrolling, or it aims at the collapsed height.
      requestAnimationFrame(() => target?.scrollIntoView({ block: "start" }));
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return null;
}
