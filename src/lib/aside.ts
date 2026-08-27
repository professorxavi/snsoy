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
 * links are broken today. Adding a type here is what makes them work, one
 * renderer at a time. The server loader map is total over this list, so every
 * declared type has a renderer.
 *
 * Creatures were the big one at 15,887 references, more than spells, items and
 * conditions together, and joined the list with the stat block renderer.
 *
 * Items arrive as three types — 6,009 references to `item`, 1,787 to `baseitem`
 * and 386 to `itemGroup` — because a single `{@item}` tag covers magic items,
 * mundane gear and groups alike. All three share one renderer, so all three
 * belong here or a tag would open for some of its targets and not others.
 *
 * The five short rules types arrived together and closed ~2,280 dead links
 * between them: senses were the largest remaining gap after items at 794
 * references — four entities carrying more inbound links than any other unbuilt
 * type, because every stat block that says "darkvision 60 ft." is one of them —
 * then actions at 743, statuses at 479, variant rules at 189 and languages at 75.
 *
 * The four player options came next, and they are the first types here chosen
 * for what a *player* looks up rather than for how often the books cite them —
 * nobody writes "see the Grappler feat" in prose, and everybody searches for it
 * directly. 179 inbound links to backgrounds, 167 to feats, 63 to optional
 * features and 45 to character options, against 396 entities between them.
 *
 * The four DM reference types cost nothing to add — 99 entities between them,
 * all in `generic_entities`, all rendering through the panel the short rules
 * types already had. Traps and hazards are the pair a chapter actually cites:
 * a room description saying the floor gives way to a {@trap pit trap} is a
 * link that used to go nowhere.
 *
 * The four lore types close the largest block of dead links left in book text
 * after the items: 535 references to deities alone. They are also the batch
 * that proved most of what a type knows may sit outside `entries` — a deity's
 * domains and symbol, and a cult's goal.
 *
 * The last five close the list. Cards were not a renderer problem at all: all
 * 545 of their tags resolved to nothing because a card's key carries its deck
 * and `{@card}` was read as though the deck were a source. Vehicles are the
 * only type here that needed a stat block of its own, and `table` earns a place
 * without earning a browse view — see `DIRECTORY`.
 *
 * With those, every browsable type has a renderer, so nothing in the books
 * links to a panel that cannot open. The guards that check this list are kept:
 * a type added to `routes.ts` without one must go on navigating, not open an
 * empty panel over the page.
 */
export const ASIDE_TYPE_LIST = [
  "spell",
  "class",
  "race",
  "skill",
  "condition",
  "monster",
  "item",
  "baseitem",
  "itemGroup",
  "magicvariant",
  "sense",
  "action",
  "status",
  "variantrule",
  "language",
  "background",
  "feat",
  "optionalfeature",
  "charoption",
  "trap",
  "hazard",
  "disease",
  "object",
  "deity",
  "reward",
  "cult",
  "boon",
  "card",
  "deck",
  "vehicle",
  "vehicleUpgrade",
  "table",
] as const satisfies readonly BrowsableType[];

export type AsideType = (typeof ASIDE_TYPE_LIST)[number];

export const ASIDE_TYPES: ReadonlySet<BrowsableType> = new Set(ASIDE_TYPE_LIST);

export function isAsideType(type: BrowsableType): type is AsideType {
  return ASIDE_TYPES.has(type as AsideType);
}

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
