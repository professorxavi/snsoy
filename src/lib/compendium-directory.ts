import { listHrefFor, type BrowsableType } from "./routes";

/**
 * Which content the compendium index lists, and how it groups.
 *
 * Grouping affects navigation only, not URLs: every type keeps its own
 * top-level segment (`/compendium/spells`, `/compendium/traps`), because the
 * URL scheme requires one segment to name exactly one entity type.
 *
 * Most cards browse a whole type and take their route from it. Two kinds do
 * not, and both name their own `route`:
 *
 * - **A slice of a type.** Sidekicks are `class` rows that happen to carry
 *   `isSidekick`, and they get a card because a player looking for one is not
 *   looking for a class. Such a card names no type at all.
 * - **A type that shares a list.** `baseitem` and `itemGroup` are browsed from
 *   `/compendium/items` with its category filter set, because nobody looking
 *   for a longsword knows the mundane one and the +1 are filed apart. They
 *   still name their type, so the index is still provably complete, and they
 *   still keep their own URL segment for the entities themselves — which is the
 *   same rule the route map follows: blend types in the list, never in the
 *   segment.
 */

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
 * Types with a browse view built. Everything else is listed but rendered inert
 * rather than as a link that 404s. Add a type here when its browse view lands.
 */
export const IMPLEMENTED: ReadonlySet<BrowsableType> = new Set<BrowsableType>([
  "spell",
  "race",
  "class",
  "skill",
  "condition",
  "monster",
  "item",
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
  "recipe",
  "reward",
  "cult",
  "boon",
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
        blurb: "Ancestries and the subraces beneath them.",
      },
      {
        type: "class",
        label: "Classes",
        blurb: "Progression, features and subclasses.",
      },
      {
        label: "Sidekicks",
        blurb: "The three companion classes, for a party of one.",
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
        blurb: "Talents taken in place of an ability score increase.",
      },
      {
        type: "optionalfeature",
        label: "Optional Features",
        blurb: "Invocations, maneuvers, metamagic and fighting styles.",
      },
      {
        type: "charoption",
        label: "Character Options",
        blurb: "Extra choices a book adds at character creation.",
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
        blurb: "Statblocks by challenge rating, type and size.",
      },
      /*
       * Three cards, one list. `item`, `baseitem` and `itemGroup` are separate
       * entity types and keep separate URL segments, but nobody browsing for a
       * longsword knows that the mundane one and the +1 are filed apart — so
       * the two narrower cards arrive at the same route with its category
       * filter already set, the way the sidekicks card names its own route.
       */
      {
        type: "item",
        label: "Magic Items",
        blurb: "By rarity, attunement and what carries them.",
      },
      {
        type: "baseitem",
        label: "Equipment",
        blurb: "Weapons, armour and everything bought with gold.",
        route: "/compendium/items?category=baseitem",
        ready: true,
      },
      {
        type: "itemGroup",
        label: "Item Groups",
        blurb: "Items that arrive as a set or a random table.",
        route: "/compendium/items?category=itemGroup",
        ready: true,
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
        type: "status",
        label: "Statuses",
        blurb: "Concentration, surprise and similar markers.",
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
        type: "sense",
        label: "Senses",
        blurb: "Darkvision, tremorsense and truesight.",
      },
      {
        type: "variantrule",
        label: "Variant Rules",
        blurb: "Optional rules a table can choose to adopt.",
      },
      {
        type: "language",
        label: "Languages",
        blurb: "Scripts, and who you can talk to.",
      },
      {
        type: "table",
        label: "Tables",
        blurb: "Roll tables lifted out of the books.",
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
      {
        type: "cult",
        label: "Cults",
        blurb: "Followings, and what they serve.",
      },
      {
        type: "boon",
        label: "Boons",
        blurb: "Epic gifts for characters past 20th level.",
      },
      {
        type: "reward",
        label: "Rewards",
        blurb: "Blessings, charms and supernatural favours.",
      },
      {
        type: "recipe",
        label: "Recipes",
        blurb: "Food and drink, with what they do.",
      },
    ],
  },
  {
    id: "dm",
    label: "DM Tools",
    entries: [
      {
        type: "trap",
        label: "Traps",
        blurb: "A trigger, an effect and a way to beat it.",
      },
      {
        type: "hazard",
        label: "Hazards",
        blurb: "Dangers that come with the terrain.",
      },
      {
        type: "disease",
        label: "Diseases",
        blurb: "Afflictions and how they worsen.",
      },
      {
        type: "object",
        label: "Objects",
        blurb: "Breakable things, with armour class and hit points.",
      },
      {
        type: "vehicle",
        label: "Vehicles",
        blurb: "Ships, mounts and war machines.",
      },
      {
        type: "vehicleUpgrade",
        label: "Vehicle Upgrades",
        blurb: "Components and modifications.",
      },
      {
        type: "deck",
        label: "Decks",
        blurb: "Decks of many things, and their relatives.",
      },
      {
        type: "card",
        label: "Cards",
        blurb: "The individual cards those decks deal.",
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
