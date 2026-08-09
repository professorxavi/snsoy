import type { BrowsableType } from "./routes";

/**
 * What the aside can show, and how it names it.
 *
 * A plain module on purpose. Both sides need this: the click wrapper is a
 * client component and the browse table is a server one, and a `"use client"`
 * module cannot be called from the server — only rendered or passed as a prop.
 */

/**
 * How the aside identifies an entity, for its cache and for marking the open
 * row. Everything that opens something must agree on this, or the same entity
 * reached two ways becomes two cache entries and no selected row.
 */
export function asideKey(
  type: BrowsableType,
  sourceId: string,
  slug: string,
): string {
  return `${type}:${sourceId.toLowerCase()}:${slug}`;
}

/**
 * The types the aside can render. Everything else keeps navigating.
 *
 * Much of what book text links to still has no page and no renderer, and those
 * links are broken today — 4,780 item references are the largest remaining
 * block. Adding a type here is what makes them work, one renderer at a time,
 * and it must stay in step with the switch in `openEntityAside`.
 *
 * Creatures were the big one at 15,887 references, more than spells, items and
 * conditions together, and joined the list with the stat block renderer.
 */
export const ASIDE_TYPES = new Set<BrowsableType>([
  "spell",
  "class",
  "race",
  "skill",
  "condition",
  "monster",
]);

/**
 * Marks a link that must navigate even inside the aside.
 *
 * The aside wraps its own body so that a reference inside an entity opens the
 * next one — but "Open full page" points at the very entity already showing, so
 * without an opt-out it is caught by that same wrapper and does nothing at all.
 * Put this on any link whose whole purpose is to leave.
 */
export const ASIDE_IGNORE_ATTR = "data-aside-ignore";

/**
 * Marks a link that opens the aside in place rather than loading a page.
 *
 * Read by the navigation progress bar, which otherwise has no way to tell the
 * two apart: `next/link` cancels the click on every navigation it handles, so a
 * cancelled click means only "something took this", never what took it or
 * whether a page is now on its way.
 *
 * Only needed on links the aside claims from a bubble handler. The ones
 * `AsideLinks` claims stop propagating during capture and never reach the bar
 * at all.
 */
export const ASIDE_OPEN_ATTR = "data-aside-open";
