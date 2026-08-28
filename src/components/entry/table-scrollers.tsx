"use client";

import { useEffect } from "react";

/** The mark a frame puts on the box that may end up scrolling. */
export const TABLE_SCROLL_ATTR = "data-table-scroll";

/** Where the frame leaves the name to use if the box turns out to scroll. */
export const TABLE_LABEL_ATTR = "data-table-label";

/** Set by the frame on a box whose height it caps, and only there. */
const TABLE_BOUNDED_ATTR = "data-table-bounded";

/**
 * Whether a table's box scrolls, decided once for every table on the page.
 *
 * Overflow is the one thing about a table that cannot be known on the server:
 * whether it is wider than the room it was given depends on the laid-out box.
 * It decides whether the region is reachable by keyboard at all, so it has to
 * be answered — but it does not have to be answered by a component per table.
 *
 * It used to be. Every table was a client component holding its own state, its
 * own `ResizeObserver` and its own scroll listener, which on Xanathar's
 * *Dungeon Master's Tools* meant 88 of each — 77 of them for reading tables
 * that fit and were only confirming it. The frame is a server component again,
 * and this is the whole of the client side: one observer, one listener, and one
 * pass over whatever is in the document.
 *
 * What it writes it owns. React never renders these attributes, so there is
 * nothing for it to reconcile away, and the frame's own markup is untouched.
 */
export function TableScrollers() {
  useEffect(() => {
    /*
     * Each scroll owner against the table currently inside it.
     *
     * Both boxes matter and for different reasons: the owner changes size when
     * the window does, and the table changes size when its content or its font
     * does. Watching only the owner leaves the overflow state stale after a
     * font loads, because a table growing inside a box does not resize the box.
     *
     * Recorded rather than looked up again, so cleanup unobserves the element
     * that was actually observed. The table is also read as `:scope > table`
     * rather than as the first child: Chakra emits a `<style>` node ahead of
     * the table it belongs to — the Port Nyanzaru table is one — and a style
     * element has no geometry to observe at all.
     */
    const observed = new Map<HTMLElement, HTMLTableElement | null>();
    const tableIn = (node: HTMLElement) =>
      node.querySelector<HTMLTableElement>(":scope > table");

    const sync = (node: HTMLElement) => {
      // A sub-pixel remainder is not overflow. Rounding at 1px keeps a table
      // that fits from claiming a scrollbar it does not have.
      const room = node.scrollWidth - node.clientWidth;
      const start = node.scrollLeft > 1;
      const end = room > 1 && node.scrollLeft < room - 1;
      // Downwards only counts where the frame said the box is bounded; see the
      // attribute's own note in `TableFrame`.
      const block =
        node.hasAttribute(TABLE_BOUNDED_ATTR) &&
        node.scrollHeight - node.clientHeight > 1;

      toggle(node, "data-overflow-start", start);
      toggle(node, "data-overflow-end", end);
      toggle(node, "data-overflow-block", block);

      /*
       * Reachable by keyboard only when there is something to scroll to, and on
       * either axis — a matrix that fits across the page but is bounded in
       * height still has to be reachable, which the first pass missed because
       * it only ever looked sideways.
       *
       * A region that always takes a tab stop would make every table in a
       * chapter a stop on the way to the next link.
       */
      const scrolls = start || end || block;

      if (scrolls) {
        node.setAttribute("tabindex", "0");
        node.setAttribute("role", "region");
        // Written out in full by the renderer, which has the caption, the
        // section and the headings; nothing about naming is decided here.
        const label = node.getAttribute(TABLE_LABEL_ATTR);
        if (label) node.setAttribute("aria-label", label);
      } else {
        node.removeAttribute("tabindex");
        node.removeAttribute("role");
        node.removeAttribute("aria-label");
      }
    };

    const sizes = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // A table grows inside its box as much as the box grows around it, so
        // both are watched and either resolves to the same scroller.
        const node = entry.target.closest<HTMLElement>(`[${TABLE_SCROLL_ATTR}]`);
        if (node) sync(node);
      }
    });

    const refresh = () => {
      const present = new Set<Element>();

      for (const node of document.querySelectorAll<HTMLElement>(
        `[${TABLE_SCROLL_ATTR}]`,
      )) {
        present.add(node);
        const table = tableIn(node);

        if (!observed.has(node)) {
          observed.set(node, table);
          sizes.observe(node);
          if (table) sizes.observe(table);
          sync(node);
          continue;
        }

        // A list that re-sorts or re-filters replaces its table under the same
        // owner, and the observer would otherwise still be watching the old one.
        const watched = observed.get(node) ?? null;
        if (watched !== table) {
          if (watched) sizes.unobserve(watched);
          if (table) sizes.observe(table);
          observed.set(node, table);
          sync(node);
        }
      }

      for (const [node, table] of observed) {
        if (present.has(node)) continue;
        observed.delete(node);
        sizes.unobserve(node);
        if (table) sizes.unobserve(table);
      }
    };

    refresh();

    /*
     * A chapter streams in, and a navigation replaces the whole of it. Watching
     * the document for arrivals and departures is what keeps this one enhancer
     * equivalent to the per-table components it replaces, rather than a
     * mount-time snapshot that misses everything after the first paint.
     */
    let queued = 0;
    const tree = new MutationObserver(() => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        refresh();
      });
    });
    tree.observe(document.body, { childList: true, subtree: true });

    // Scroll does not bubble, so it is caught on the way down instead. One
    // listener for the document rather than one per table.
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.hasAttribute(TABLE_SCROLL_ATTR)) {
        sync(target);
      }
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (queued) cancelAnimationFrame(queued);
      tree.disconnect();
      sizes.disconnect();
      observed.clear();
    };
  }, []);

  return null;
}

function toggle(node: HTMLElement, name: string, on: boolean) {
  if (on) node.setAttribute(name, "");
  else node.removeAttribute(name);
}
