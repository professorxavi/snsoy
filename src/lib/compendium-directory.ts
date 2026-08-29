import { listHrefFor, type BrowsableType } from "./routes";

/**
 * Which content the compendium index lists, and how it groups.
 *
 * Grouping affects navigation only, not URLs: every type keeps its own
 * top-level segment (`/compendium/spells`, `/compendium/traps`), because the
 * URL scheme requires one segment to name exactly one entity type.
 *
 * Most cards browse a whole type and take their route from it. One kind does
 * not and names its own `route`: **a slice of a type**. Sidekicks are `class`
 * rows that happen to carry `isSidekick`, and they get a card because a player
 * looking for one is not looking for a class. Such a card names no type at all.
 *
 * Sixteen types have no card, and none of them has a browse view either — see
 * `WITHOUT_A_BROWSE_VIEW`.
 */

/**
 * Browsable types with no browse view, and so nothing for a card to point at.
 *
 * Each is dropped rather than deferred, and dropping a card drops the browse
 * view, not the type: every one keeps its URL segment so `hrefFor` still
 * addresses their entities, and every one still opens in the aside.
 *
 * - **`table`.** The seven `table` entities are not where the 521 `{@table}`
 *   references in book text point: a real roll table lives inside the chapter
 *   that uses it and renders there, and a chapter's table belongs to that
 *   chapter. All but three of those references now resolve to the chapter that
 *   prints them — see `tableAnchorId` — so the content is reachable where it is
 *   used, and a `/compendium/tables` route would be a near-empty index over the
 *   seven rows that happen to have been ingested separately.
 * - **`baseitem` and `itemGroup`.** Both are ingest artifacts rather than
 *   distinctions a reader makes. `baseitem` is only the 124 PHB core rows —
 *   567 of the 3,448 `item` rows are non-magic too, so the split is not magic
 *   against mundane, which is what `isMagic` answers and what the rail already
 *   asks. And a group is a heading over items that exist in their own right:
 *   372 of 402 member references resolve to real rows, and 66 of the 73 groups
 *   are reached from book text, which is where a group belongs — in the aside,
 *   under the `{@item}` tag that cites it.
 * - **`magicvariant`.** The 129 magic items the books print once and the data
 *   expands: "Flame Tongue" is one entry in the DMG, and the expansion into
 *   `Flame Tongue Longsword`, `Flame Tongue Rapier` and five more is what fills
 *   the items list — 1,852 of the 3,634 item rows are expansions of these 129.
 *   The expansions are also the rows that can answer a list's questions: of the
 *   129 templates, one carries an item type and none carries a value or a
 *   weight, because "+1 Weapon" has no type — it *applies to* one. So the
 *   template is here to be cited and read, not browsed: all 362 `{@item}`
 *   references that resolved to nothing were naming one of these, and they open
 *   the magic item as it was printed.
 * - **`card`.** A card is only ever met through its deck, and the deck panel
 *   already lists every card it deals. A flat list of all 656 was the one place
 *   in the app where that context had to be rebuilt with a facet — the rail's
 *   sole filter was the deck — which is a list earning its keep by undoing its
 *   own premise. `/compendium/decks` stays, and the aside still opens a card
 *   from a deck's contents or from a `{@card}` tag in a chapter.
 * - **`optionalfeature` and `charoption`.** Both are choices something else
 *   offers, and both already render where the choice is made: a warlock's 54
 *   invocations sit on the class page under the feature that grants them, and
 *   each of the 44 character options belongs to one setting. Listing all 151
 *   options flat asks a question about the data rather than about a character,
 *   and the answer is only legible next to the feature it qualifies. Both still
 *   open in the aside, from a class page or from the tag that cites them.
 * - **`vehicleUpgrade`.** 31 rows in two families that never mix — a ship's
 *   hulls and sails, an infernal war machine's armour and gadgets — and an
 *   upgrade only means anything next to the thing it is bolted to. Nobody
 *   shops for one cold. `/compendium/vehicles` stays, and the 34
 *   `{@vehupgrade}` references in book text still open one in the aside, which
 *   is the whole reason the type was built.
 * - **`sense`, `status`, `boon`, `reward`, `cult`, `trap`, `hazard` and
 *   `object`.** These eight kept a list for a while after losing their card,
 *   on the theory that a hidden route still served the reader who typed the URL.
 *   It served nobody: nothing linked to them but the 404 signpost, which is a
 *   thin reason for a route to exist. Every one of them is met through the thing
 *   that cites it — darkvision on a stat block, a pit trap in a room
 *   description — and follows the tag into the aside, which is untouched.
 */
export const WITHOUT_A_BROWSE_VIEW: ReadonlySet<BrowsableType> =
  new Set<BrowsableType>([
    "table",
    "baseitem",
    "itemGroup",
    "magicvariant",
    "card",
    "optionalfeature",
    "charoption",
    "vehicleUpgrade",
    "sense",
    "status",
    "boon",
    "reward",
    "cult",
    "trap",
    "hazard",
    "object",
  ]);

export interface DirectoryEntry {
  /** The type this card browses, when it browses a whole one. */
  type?: BrowsableType;
  label: string;
  /** One player-facing line — several of these type names mean little alone. */
  blurb: string;
  /** Where the card goes. Defaults to the list route for `type`. */
  route?: string;
  /**
   * Whether that route exists. Required on a card with no type, since nothing
   * else can say; on a typed card it overrides `IMPLEMENTED`, which answers for
   * the type's own list route and not for a shared one.
   */
  ready?: boolean;
}

export interface DirectoryGroup {
  id: string;
  label: string;
  entries: DirectoryEntry[];
}

/**
 * Types with a browse view built.
 *
 * Exactly the types the index lists — every card points at a route that exists,
 * so the "not yet built" card the index used to render has nothing left to
 * render. Kept as a set rather than folded away because a type added to
 * `routes.ts` before its view exists must still be listed inert rather than
 * linking to a 404.
 */
export const IMPLEMENTED: ReadonlySet<BrowsableType> = new Set<BrowsableType>([
  "spell",
  "race",
  "class",
  "skill",
  "condition",
  "monster",
  "item",
  "action",
  "variantrule",
  "language",
  "background",
  "feat",
  "disease",
  "deity",
  "deck",
  "vehicle",
]);

export const DIRECTORY: DirectoryGroup[] = [
  {
    id: "player",
    label: "Player",
    entries: [
      {
        type: "spell",
        label: "Spells",
        blurb: "By level, school, casting time and class.",
      },
      {
        type: "race",
        label: "Races",
        blurb: "Traits, abilities and subraces.",
      },
      {
        type: "class",
        label: "Classes",
        blurb: "Progression, features and subclasses.",
      },
      {
        label: "Sidekicks",
        blurb: "Companion classes that level up alongside a small party.",
        route: "/compendium/sidekicks",
        ready: true,
      },
      {
        type: "background",
        label: "Backgrounds",
        blurb: "Origins, proficiencies and the features they grant.",
      },
      {
        type: "feat",
        label: "Feats",
        blurb: "Talents your character can choose as they grow.",
      },
    ],
  },
  {
    id: "bestiary",
    label: "Bestiary & Treasure",
    entries: [
      {
        type: "monster",
        label: "Monsters",
        blurb: "Creatures by challenge rating, type and size.",
      },
      /*
       * One card, not three. `baseitem` and `itemGroup` used to have their own,
       * pointing at this same list with its category filter set — but the split
       * they advertised is not one a reader makes, and not one the data backs
       * either: see `WITHOUT_A_CARD`.
       */
      {
        type: "item",
        label: "Items",
        blurb: "Weapons, armour, treasure and gear, by rarity and attunement.",
      },
    ],
  },
  {
    id: "rules",
    label: "Rules & Reference",
    entries: [
      {
        type: "condition",
        label: "Conditions",
        blurb: "Blinded, charmed, prone and the rest.",
      },
      {
        type: "action",
        label: "Actions",
        blurb: "What you can do on your turn.",
      },
      {
        type: "skill",
        label: "Skills",
        blurb: "What each skill actually covers.",
      },
      {
        type: "variantrule",
        label: "Variant Rules",
        blurb: "Optional rules a table can choose to adopt.",
      },
      {
        type: "language",
        label: "Languages",
        blurb: "Scripts and who you can talk to.",
      },
    ],
  },
  {
    id: "lore",
    label: "Lore & Setting",
    entries: [
      {
        type: "deity",
        label: "Deities",
        blurb: "Pantheons, domains and holy symbols.",
      },
    ],
  },
  {
    id: "dm",
    label: "DM Tools",
    entries: [
      {
        type: "disease",
        label: "Diseases",
        blurb: "Afflictions and how they worsen.",
      },
      {
        type: "vehicle",
        label: "Vehicles",
        blurb: "Ships, mounts and war machines.",
      },
      /*
       * One card for the pair. Cards used to have their own, next to this one:
       * a deck and a card do answer different questions, but only the deck's is
       * asked from an index — see `WITHOUT_A_CARD`.
       */
      {
        type: "deck",
        label: "Decks",
        blurb: "Decks of many things, and the cards they deal.",
      },
    ],
  },
];

export function isImplemented(type: BrowsableType): boolean {
  return IMPLEMENTED.has(type);
}

/** Where a card goes. A typeless card carries its own route. */
export function entryHref(entry: DirectoryEntry): string {
  return entry.route ?? listHrefFor(entry.type!);
}

/**
 * Whether that route exists yet. An explicit `ready` wins: a card pointing into
 * a list it shares with another type is live even though its own type has no
 * browse view of its own and never will.
 */
export function entryReady(entry: DirectoryEntry): boolean {
  return entry.ready ?? (entry.type ? isImplemented(entry.type) : false);
}
