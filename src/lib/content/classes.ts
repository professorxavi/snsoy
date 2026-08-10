import { abilityName } from "./dnd";
import { candidateKeysForTag } from "./references";

/**
 * Shaping a class for display.
 *
 * The class table is the page. Everything a class does is indexed by level, and
 * the corpus stores that indexing in four different ways: a proficiency bonus
 * that is a formula, a feature list that is an ordered array of references, a
 * per-level grid of arbitrary cells (`classTableGroups`), and a spell-slot grid
 * with its own key. This module turns all of it into one thing — columns of
 * twenty values — so the renderer never has to know which of the four it is
 * looking at.
 */

/** Every class runs 1–20. Nothing in the corpus is shorter or longer. */
export const CLASS_LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

/** +2 at 1st, rising by one every four levels. The one rule with no data behind it. */
export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

/** "1st", "2nd", "3rd", "11th", "20th". */
export function ordinal(value: number): string {
  const teens = value % 100;
  if (teens >= 11 && teens <= 13) return `${value}th`;

  const suffix = { 1: "st", 2: "nd", 3: "rd" }[value % 10] ?? "th";
  return `${value}${suffix}`;
}

/**
 * "Strength & Constitution", in the order the abilities were given. Names in
 * full, not the three-letter form the race pages use: a class's saving throws
 * are printed as prose in a summary line, where an abbreviation reads as a
 * stat block.
 */
export function formatAbilities(abbreviations: string[] | null): string | null {
  if (!abbreviations?.length) return null;
  return abbreviations.map(abilityName).join(" & ");
}

/**
 * How much of a caster this is, in the words a player uses. `casterProgression`
 * is a slot-table key upstream, and "1/2" on its own says nothing.
 */
const CASTER_LABELS: Record<string, string> = {
  full: "Full caster",
  "1/2": "Half caster",
  "1/3": "Third caster",
  pact: "Pact magic",
  artificer: "Artificer casting",
};

export function casterLabel(progression: string | null): string | null {
  return progression ? (CASTER_LABELS[progression] ?? progression) : null;
}

/* ------------------------------------------------------------------ *
 * The class table
 * ------------------------------------------------------------------ */

export interface ProgressionColumn {
  /** Column heading. May carry inline tags, so it is rendered, not printed. */
  label: string;
  /** The heading printed above a run of columns, e.g. "Spell Slots per Spell Level". */
  group?: string;
  /** One value per class level, low to high. Always `CLASS_LEVELS.length` long. */
  values: string[];
}

interface TableGroup {
  title?: string;
  colLabels?: string[];
  rows?: unknown[][];
  /** Spell slots by level. Same shape as `rows`, under its own key upstream. */
  rowsSpellProgression?: number[][];
}

/**
 * The columns a class adds to the standard three, flattened out of its table
 * groups. A group is a run of columns under one heading — the nine spell-slot
 * columns are one group; the Barbarian's Rages and Rage Damage are another with
 * no heading at all.
 */
export function progressionColumns(data: unknown): ProgressionColumn[] {
  const groups = (data as { classTableGroups?: TableGroup[] })?.classTableGroups;
  if (!Array.isArray(groups)) return [];

  const columns: ProgressionColumn[] = [];

  for (const group of groups) {
    const rows = group.rowsSpellProgression ?? group.rows ?? [];

    group.colLabels?.forEach((label, index) => {
      columns.push({
        label,
        group: group.title,
        values: CLASS_LEVELS.map((level) => cellText(rows[level - 1]?.[index])),
      });
    });
  }

  return columns;
}

/**
 * One cell of a table group. Five shapes occur across the corpus: a number, a
 * string ("Unlimited"), a bonus, a speed bonus, and a die.
 *
 * Zero is nothing rather than a quantity — an empty spell-slot column, a Monk's
 * unarmoured movement before it starts — and prints as a dash, which is how the
 * books set it.
 */
function cellText(cell: unknown): string {
  if (cell == null) return "—";
  if (typeof cell === "number") return cell === 0 ? "—" : String(cell);
  if (typeof cell === "string") return cell;

  const value = cell as {
    type?: string;
    value?: number;
    toRoll?: { number?: number; faces?: number }[];
  };

  switch (value.type) {
    case "bonus":
      return value.value == null ? "—" : `+${value.value}`;

    case "bonusSpeed":
      return !value.value ? "—" : `+${value.value} ft.`;

    case "dice": {
      const die = value.toRoll?.[0];
      return die?.faces ? `${die.number ?? 1}d${die.faces}` : "—";
    }

    default:
      return "—";
  }
}

/**
 * A class's descriptive text, taken from its fluff.
 *
 * Only the book that printed the class gets a say. Every class's fluff carries
 * a second top-level section from a later supplement — Xanathar's for the PHB
 * twelve, Eberron's for the Artificer — running to pages of roleplaying tables
 * that arrive before the class table and read as though the class were theirs.
 * A page about the PHB Warlock is the PHB's Warlock.
 *
 * Every class then wraps its description in a section named after the class,
 * which on a page already titled with that name renders as a heading that
 * repeats the one above it. Unwrapping it here rather than hiding it in the
 * renderer keeps the section's own children — "Creating a Wizard" and the rest
 * — at the depth the page expects.
 */
export function descriptionEntries<T>(
  fluff: unknown,
  className: string,
  sourceId: string,
): T[] {
  const entries = (fluff as { entries?: unknown[] } | null)?.entries;
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry) => {
    const section = entry as {
      name?: string;
      source?: string;
      entries?: unknown[];
    };

    // An entry with no source of its own is the class's own text.
    if (section?.source && !sameSource(section.source, sourceId)) return [];

    return section?.name === className && Array.isArray(section.entries)
      ? (section.entries as T[])
      : [entry as T];
  });
}

function sameSource(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/* ------------------------------------------------------------------ *
 * Starting proficiencies
 * ------------------------------------------------------------------ */

export interface ProficiencyLine {
  label: string;
  /** May carry inline tags — several tool and weapon grants are item links. */
  value: string;
}

const ARMOUR_NAMES: Record<string, string> = {
  light: "light armor",
  medium: "medium armor",
  heavy: "heavy armor",
  shield: "shields",
};

const WEAPON_NAMES: Record<string, string> = {
  simple: "simple weapons",
  martial: "martial weapons",
};

const COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six"];

const count = (value: number) => COUNT_WORDS[value] ?? String(value);

/**
 * "sleight of hand" as the books set it — the joining words stay lowercase.
 *
 * Shared with the feat and background lists, which name the same kinds of
 * things: proficiencies, and other entities cited by their lowercase key.
 * Without the small words a feat prerequisite reads "Scion Of The Outer
 * Planes", which is not how any book prints it. The first word is always
 * capitalised, since it opens the phrase.
 */
const SMALL_WORDS = new Set(["of", "the", "a", "an", "and", "or", "to", "in"]);

export function titleCase(value: string): string {
  return value
    .split(" ")
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word) ? word : capitalize(word),
    )
    .join(" ");
}

/**
 * The first *letter*, not the first character, and once per hyphenated part.
 * The names this runs over are written "half-elf", "thieves' tools" and
 * "(evil outer plane)", and capitalising position zero would leave two of the
 * three untouched.
 */
function capitalize(word: string): string {
  return word
    .split("-")
    .map((part) => part.replace(/[a-z]/, (letter) => letter.toUpperCase()))
    .join("-");
}

const sentence = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

/**
 * What a class starts proficient in, as the four lines the books print.
 *
 * Every one of the four is stored differently. Armour and weapons are arrays of
 * either a keyword or an object carrying its own prose; tools are either a list
 * of item tags or a map of names to counts; skills are a choice. A line with
 * nothing behind it is dropped rather than printed as "None" — a Sorcerer has
 * no tool proficiencies, and a row saying so is a row of noise.
 */
export function proficiencyLines(data: unknown): ProficiencyLine[] {
  const starting = (data as { startingProficiencies?: Record<string, unknown> })
    ?.startingProficiencies;
  if (!starting) return [];

  return [
    { label: "Armor", value: listOf(starting.armor, ARMOUR_NAMES) },
    { label: "Weapons", value: listOf(starting.weapons, WEAPON_NAMES) },
    { label: "Tools", value: toolList(starting) },
    { label: "Skills", value: skillList(starting.skills) },
  ].filter((line): line is ProficiencyLine => Boolean(line.value));
}

/** Armour and weapons: a keyword, a phrase of its own, or an optional grant. */
function listOf(value: unknown, names: Record<string, string>): string {
  if (!Array.isArray(value)) return "";

  const parts = value.map((item) => {
    if (typeof item === "string") return names[item] ?? item;

    const grant = item as { full?: string; proficiency?: string; optional?: boolean };
    const name = grant.full ?? names[grant.proficiency ?? ""] ?? grant.proficiency ?? "";
    return grant.optional && name ? `${name} (optional)` : name;
  });

  return sentence(parts.filter(Boolean).join(", "));
}

/**
 * Tools come from either key. `tools` is a list of item tags; `toolProficiencies`
 * is a map whose numeric values are open choices — "three musical instruments of
 * your choice" — and whose `true` values are named tools.
 */
function toolList(starting: Record<string, unknown>): string {
  if (Array.isArray(starting.tools)) {
    return sentence(starting.tools.filter((tool) => typeof tool === "string").join(", "));
  }

  const grants = starting.toolProficiencies;
  if (!grants || typeof grants !== "object") return "";

  const parts: string[] = [];

  for (const [key, value] of Object.entries(grants as Record<string, unknown>)) {
    if (value === true) {
      parts.push(titleCase(key));
      continue;
    }
    if (typeof value !== "number") continue;

    const kind =
      key === "anyArtisansTool"
        ? "artisan's tools"
        : key === "anyMusicalInstrument"
          ? "musical instruments"
          : "tools";
    parts.push(
      value === 1
        ? `one ${kind.replace(/s$/, "")} of your choice`
        : `${count(value)} ${kind} of your choice`,
    );
  }

  return sentence(parts.join(", "));
}

/** "Choose two from Acrobatics, Animal Handling…", or an open choice of any. */
function skillList(value: unknown): string {
  if (!Array.isArray(value)) return "";

  const parts = value.map((grant) => {
    const choice = grant as {
      any?: number;
      choose?: { from?: string[]; count?: number };
    };

    if (typeof choice.any === "number") {
      return `Choose any ${count(choice.any)}`;
    }

    const from = choice.choose?.from ?? [];
    if (from.length === 0) return "";

    return `Choose ${count(choice.choose?.count ?? 1)} from ${from
      .map(titleCase)
      .join(", ")}`;
  });

  return parts.filter(Boolean).join("; ");
}

/**
 * The equipment lines a class starts with. Already written as prose upstream,
 * tags and all — the only thing to decide is whether there are any.
 */
export function startingEquipment(data: unknown): string[] {
  const equipment = (data as { startingEquipment?: { default?: unknown[] } })
    ?.startingEquipment?.default;

  return Array.isArray(equipment)
    ? equipment.filter((line): line is string => typeof line === "string")
    : [];
}

/* ------------------------------------------------------------------ *
 * Features referenced by other features
 * ------------------------------------------------------------------ */

/** A feature's text, for printing inside the feature that introduces it. */
export interface FeatureBody {
  name: string;
  entries?: unknown[];
}

/** Feature bodies by natural key. */
export type FeatureIndex = Record<string, FeatureBody>;

/**
 * The feature a `refClassFeature` or `refSubclassFeature` entry points at.
 *
 * These are how the corpus composes a feature out of others: an Alchemist's
 * opening feature references the three it grants, and Perfected Armor
 * references the two armor models it chooses between. Every one of the 343 in
 * the corpus points at a feature of the same class, already loaded by the page
 * that is rendering it — so this resolves against what is in hand rather than
 * going back to the database.
 *
 * The reference is pipe-delimited in the same order the matching inline tag
 * uses, which is why it is read by the same key construction.
 */
export function featureReferenceKey(entry: unknown): string | null {
  const node = entry as {
    type?: string;
    classFeature?: string;
    subclassFeature?: string;
  };

  const name =
    node?.type === "refClassFeature"
      ? "classFeature"
      : node?.type === "refSubclassFeature"
        ? "subclassFeature"
        : null;

  const reference = node?.classFeature ?? node?.subclassFeature;
  if (!name || typeof reference !== "string") return null;

  const [key] = candidateKeysForTag({
    kind: "tag",
    name,
    parts: reference.split("|"),
    raw: reference,
  });

  return key ?? null;
}

/** Every feature referenced from within a value, at any depth. */
export function collectFeatureReferences(value: unknown): Set<string> {
  const found = new Set<string>();

  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;

    const key = featureReferenceKey(node);
    if (key) found.add(key);

    Object.values(node).forEach(visit);
  };

  visit(value);
  return found;
}

/** Loaded features into the index the renderer reads. */
export function indexFeatures(
  features: { naturalKey: string; name: string; data: unknown }[],
): FeatureIndex {
  const index: FeatureIndex = {};

  for (const feature of features) {
    index[feature.naturalKey] = {
      name: feature.name,
      entries: (feature.data as { entries?: unknown[] })?.entries,
    };
  }

  return index;
}

/* ------------------------------------------------------------------ *
 * Feature order
 * ------------------------------------------------------------------ */

/**
 * The order a class's features are printed in, by name.
 *
 * Features are stored as their own entities, and a query can only order them by
 * level — which leaves the features gained at the same level in whatever order
 * the database returns. The class itself carries the printed order, as an array
 * of reference strings ("Second Wind|Fighter||1"), and that is the only record
 * of it. A name missing from the array sorts last rather than first, so a
 * feature the array does not mention cannot displace one it does.
 */
export function featureOrder(data: unknown): Map<string, number> {
  const listed = (data as { classFeatures?: unknown[] })?.classFeatures ?? [];
  const order = new Map<string, number>();

  listed.forEach((item, index) => {
    const reference =
      typeof item === "string"
        ? item
        : ((item as { classFeature?: string })?.classFeature ?? "");
    const name = reference.split("|")[0]?.trim();

    if (name && !order.has(name)) order.set(name, index);
  });

  return order;
}

/** Sorts features by level, then by the order the class prints them in. */
export function byPrintedOrder<T extends { name: string; level: number }>(
  order: Map<string, number>,
): (a: T, b: T) => number {
  return (a, b) =>
    a.level - b.level ||
    (order.get(a.name) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.name) ?? Number.MAX_SAFE_INTEGER) ||
    a.name.localeCompare(b.name);
}
