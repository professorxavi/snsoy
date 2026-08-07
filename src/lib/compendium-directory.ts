import type { BrowsableType } from "./routes";

/**
 * The compendium's front door: which content types exist, and how they group.
 *
 * Grouping is **navigation, not URL structure**. Every type keeps its own
 * top-level segment (`/compendium/spells`, `/compendium/traps`) because the URL
 * scheme depends on one segment naming exactly one entity type. This file only
 * decides what sits next to what on the index, and what gets prominence — a
 * flat grid of 34 equally-weighted links would be a table of contents for a
 * database rather than a way into the game.
 *
 * Deliberately no counts. "Monsters 3,808" is a fact about our import, not
 * something that helps anyone prepare a session, and it is the fastest way to
 * make the product read as a database browser.
 */

export interface DirectoryEntry {
  type: BrowsableType;
  label: string;
  /** One line, player-facing. Half these types are unrecognisable by name. */
  blurb: string;
}

export interface DirectoryGroup {
  id: string;
  label: string;
  entries: DirectoryEntry[];
}

/**
 * Types with a browse view built.
 *
 * Everything else is listed but inert — the shape of the compendium is worth
 * showing even where a section is not ready, and a link that 404s is worse than
 * one that says it is not here yet. Add a type here when its slice lands; that
 * is the only change this page needs per slice.
 */
export const IMPLEMENTED: ReadonlySet<BrowsableType> = new Set<BrowsableType>([
  "spell",
  "race",
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
        type: "subclass",
        label: "Subclasses",
        blurb: "Every archetype, listed on its own.",
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
      {
        type: "item",
        label: "Magic Items",
        blurb: "By rarity, attunement and what carries them.",
      },
      {
        type: "baseitem",
        label: "Equipment",
        blurb: "Weapons, armour and everything bought with gold.",
      },
      {
        type: "itemGroup",
        label: "Item Groups",
        blurb: "Items that arrive as a set or a random table.",
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
        type: "psionic",
        label: "Psionics",
        blurb: "Disciplines and talents for the mind.",
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
