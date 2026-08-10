/**
 * The entry shapes the renderer handles.
 *
 * The source data defines roughly twenty entry types. Unhandled types render a
 * visible fallback and report themselves to the coverage report, which drives
 * what gets added next. Measured over all 1,006 book and adventure sections,
 * the types below cover all but ~250 occurrences out of 79,000.
 */

import type { ImageEntry } from "@/lib/content/media";

export type Entry = string | number | EntryObject;

export interface EntriesEntry {
  type: "entries";
  name?: string;
  entries?: Entry[];
}

export interface ListEntry {
  type: "list";
  items?: Entry[];
  style?: string;
}

export interface ItemEntry {
  type: "item" | "itemSpell" | "itemSub";
  name?: string;
  entry?: Entry;
  entries?: Entry[];
}

/** A table cell carrying a die roll. `exact` is one result, `min`/`max` a span. */
export interface CellEntry {
  type: "cell";
  roll?: {
    exact?: number;
    min?: number;
    max?: number;
    /** Pad to the table's width, so 1 becomes "01" in a d100 table. */
    pad?: boolean;
  };
}

/**
 * A row that carries its own layout hint. Most table rows are bare arrays; a
 * few are wrapped like this, and treating the wrapper as a cell would render
 * the object rather than its contents.
 */
export interface RowEntry {
  type: "row";
  row?: (Entry | CellEntry)[];
  style?: string;
}

export interface TableEntry {
  type: "table";
  caption?: string;
  colLabels?: string[];
  /** Upstream layout hints: column widths and alignment, as class names. */
  colStyles?: string[];
  rows?: ((Entry | CellEntry)[] | RowEntry)[];
}

/** Several tables printed under one heading, as a single figure. */
export interface TableGroupEntry {
  type: "tableGroup";
  name?: string;
  tables?: TableEntry[];
}

/**
 * A derived number a feature grants: a save DC or an attack modifier. The
 * ability it keys off is data, not prose, because it differs by class.
 */
export interface AbilityFormulaEntry {
  type: "abilityDc" | "abilityAttackMod";
  /** "Spell", "Maneuver". */
  name?: string;
  /** Ability abbreviations, or the literal `spellcasting`. */
  attributes?: string[];
}

/**
 * A choice between optional features — fighting styles, metamagic, maneuvers.
 * Its children are usually `refOptionalfeature`, but plain entries occur.
 */
export interface OptionsEntry {
  type: "options";
  /** How many may be taken. The prose above almost always says so too. */
  count?: number;
  entries?: Entry[];
}

/** One option, named rather than written out. */
export interface RefOptionalFeatureEntry {
  type: "refOptionalfeature";
  /** `Name` or `Name|SOURCE`, addressing an `optionalfeature` entity. */
  optionalfeature: string;
}

export interface QuoteEntry {
  type: "quote";
  entries?: Entry[];
  by?: string;
  from?: string;
}

/** A sidebar. `insetReadaloud` is text meant to be read aloud. */
export interface InsetEntry {
  type: "inset" | "insetReadaloud";
  name?: string;
  entries?: Entry[];
}

/**
 * An optional rule attached to a stat block — "Variant: Chain Devils Are
 * Reborn", the dragon-customising insets. Boxed like a sidebar, because that is
 * what it is: something the DM may adopt, not part of the creature as printed.
 *
 * `variantInner` and `variantSub` are its named subdivisions, three of each in
 * the whole corpus.
 */
export interface VariantEntry {
  type: "variant" | "variantInner" | "variantSub";
  name?: string;
  entries?: Entry[];
}

/**
 * A creature's spellcasting, which the corpus stores as structure rather than
 * prose: prepared spells by level with their slot counts, innate spells by how
 * often they may be cast.
 *
 * The groups are keyed by frequency (`will`) or by a count with an optional
 * `e` suffix — `daily: {"1e": [...]}` is "1/day each", `{"2": [...]}` is
 * "2/day". `spells` is keyed by spell level instead, and level 0 is cantrips.
 *
 * `displayAs` decides where the block belongs: a stat block prints most
 * spellcasting among its traits, but 473 of these say `"action"` and belong
 * under Actions with the attacks.
 */
export interface SpellcastingEntry {
  type: "spellcasting";
  name?: string;
  headerEntries?: Entry[];
  footerEntries?: Entry[];
  /** Spell name tags, e.g. `{@spell fireball}`. */
  will?: Entry[];
  daily?: Record<string, Entry[]>;
  rest?: Record<string, Entry[]>;
  weekly?: Record<string, Entry[]>;
  yearly?: Record<string, Entry[]>;
  charges?: Record<string, Entry[]>;
  recharge?: Record<string, Entry[]>;
  ritual?: Entry[];
  spells?: Record<string, { slots?: number; spells?: Entry[]; lower?: number }>;
  /** Group names the header already accounts for, so they are not printed twice. */
  hidden?: string[];
  ability?: string;
  displayAs?: string;
}

/**
 * A headed division of a chapter — the structural level above `entries`. A
 * chapter's own body is one of these: 996 of 1,006 sections have `type:
 * "section"` at the root, and 620 divide into further sections inside it.
 */
export interface SectionEntry {
  type: "section";
  name?: string;
  page?: number;
  entries?: Entry[];
}

/** Several images printed together. */
export interface GalleryEntry {
  type: "gallery";
  images?: ImageEntry[];
}

/** A horizontal rule between parts of a chapter. */
export interface HrEntry {
  type: "hr";
}

/**
 * A reference to another entity that the printed book reproduces in full — a
 * monster, a spell, a recipe. Addressed exactly as the equivalent inline tag
 * is (`tag` + `name` + `source`), so it resolves through the same index; `prop`
 * is the variant used for fluff-only targets.
 */
export interface StatblockEntry {
  type: "statblock";
  tag?: string;
  prop?: string;
  name?: string;
  source?: string;
  displayName?: string;
}

/**
 * A link out of the prose.
 *
 * `internal` addresses a page of the reference site these data files were
 * written for, which this app has no equivalent of — see `linkText`, which
 * prints those as plain words rather than as an anchor to nowhere.
 */
export interface LinkEntry {
  type: "link";
  text?: string;
  href?: {
    type?: "internal" | "external";
    url?: string;
    path?: string;
    hash?: string;
  };
}

export type EntryObject =
  | EntriesEntry
  | LinkEntry
  | ListEntry
  | ItemEntry
  | CellEntry
  | RowEntry
  | TableEntry
  | TableGroupEntry
  | AbilityFormulaEntry
  | OptionsEntry
  | RefOptionalFeatureEntry
  | QuoteEntry
  | InsetEntry
  | VariantEntry
  | SpellcastingEntry
  | SectionEntry
  | GalleryEntry
  | HrEntry
  | StatblockEntry
  | ImageEntry
  | { type: string; [key: string]: unknown };

export function isEntryObject(value: Entry): value is EntryObject {
  return typeof value === "object" && value !== null;
}

/** Cells only appear inside a table row. */
export function isCell(value: unknown): value is CellEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "cell"
  );
}

/** A wrapped table row, as opposed to the usual bare array of cells. */
export function isRow(value: unknown): value is RowEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "row"
  );
}

/** The cells of a table row, whether or not it is wrapped. */
export function cellsOf(
  row: (Entry | CellEntry)[] | RowEntry,
): (Entry | CellEntry)[] {
  if (Array.isArray(row)) return row;
  if (isRow(row)) return row.row ?? [];
  return [row];
}
