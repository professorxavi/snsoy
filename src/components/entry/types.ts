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
  /**
   * Whether the renderer supplies the period after the run-in label. Absent
   * means it does; the few entries that set it false run the name straight on
   * into the sentence — "Abjuration spells are protective in nature".
   */
  nameDot?: boolean;
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

/**
 * A heading cell that stands over more than one column, which is what a
 * multi-row header is for: `width` is its span, and the columns it covers are
 * named individually on the row below.
 */
export interface CellHeaderEntry {
  type: "cellHeader";
  entry?: Entry;
  width?: number;
  style?: string;
}

export interface TableEntry {
  type: "table";
  caption?: string;
  colLabels?: string[];
  /**
   * A header of more than one row, used instead of `colLabels` rather than
   * alongside it. Three tables in the books have one; without it they print
   * with no column headings at all.
   */
  colLabelRows?: (Entry | CellHeaderEntry)[][];
  /** Upstream layout hints: column widths and alignment, as class names. */
  colStyles?: string[];
  rows?: ((Entry | CellEntry)[] | RowEntry)[];
  /** The notes printed under the table, keyed to it by asterisk. */
  footnotes?: Entry[];
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
 * A formula the books state in words rather than derive from an ability.
 *
 * One occurrence: the PHB's passive check total, "10 + all modifiers that
 * normally apply to the check". Its two siblings above compute their sentence
 * from `attributes`; this one carries the sentence, and is set apart the same
 * way because it is read the same way — copied onto a sheet, not read as prose.
 */
export interface AbilityGenericEntry {
  type: "abilityGeneric";
  text?: string;
}

/**
 * Children that belong together as one block.
 *
 * Both occurrences are the same thing — the PHB's list of conditions and the
 * Dungeon Kit screen's reprint of it — a sentence followed by the fifteen
 * names. Its sibling `inline` closes a sentence back up into one paragraph,
 * which is wrong here: a list is not part of a sentence. So this renders its
 * children as the blocks they are.
 */
export interface InlineBlockEntry {
  type: "inlineBlock";
  entries?: Entry[];
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
 * An adventure's shape, drawn in print as boxes joined by arrows.
 *
 * 17 of them across 9 chapters, 115 blocks between them — the opening summary
 * of Icewind Dale, Waterdeep: Dragon Heist and seven others. It is a container
 * and nothing else: without a case for it the renderer prints one marker and
 * drops every block inside, which is why this is the largest entry gap in the
 * data by some way — the other two are one and two occurrences.
 *
 * A block is a step: a name (83 of the 115 have one) and a paragraph or two.
 * `page` is the print page the step is described on and is not rendered, as
 * page numbers are not rendered anywhere else.
 */
export interface FlowchartEntry {
  type: "flowchart";
  blocks?: Entry[];
}

export interface FlowBlockEntry {
  type: "flowBlock";
  name?: string;
  entries?: Entry[];
  page?: number;
}

/**
 * An optional rule attached to a stat block — "Variant: Chain Devils Are
 * Reborn", the dragon-customising insets. Boxed like a sidebar, because that is
 * what it is: something the DM may adopt, not part of the creature as printed.
 *
 * `variantInner` and `variantSub` are its named subdivisions, three of each in
 * all the books.
 */
export interface VariantEntry {
  type: "variant" | "variantInner" | "variantSub";
  name?: string;
  entries?: Entry[];
}

/**
 * A creature's spellcasting, which the books store as structure rather than
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

/**
 * An attack in fields rather than in prose: the to-hit clause and the damage
 * clause apart, with the reach and kind as an `{@atk}` code.
 *
 * Only the objects use it — the bestiary writes the same sentence inline — and
 * `AttackLine` puts it back into that form rather than styling it twice.
 */
export interface AttackEntry {
  type: "attack";
  /** "MW", "RW": the `{@atk}` code, upper case. */
  attackType?: string;
  attackEntries?: string[];
  hitEntries?: string[];
}

export type EntryObject =
  | EntriesEntry
  | AttackEntry
  | LinkEntry
  | ListEntry
  | ItemEntry
  | CellEntry
  | CellHeaderEntry
  | RowEntry
  | TableEntry
  | TableGroupEntry
  | AbilityFormulaEntry
  | AbilityGenericEntry
  | InlineBlockEntry
  | OptionsEntry
  | RefOptionalFeatureEntry
  | QuoteEntry
  | InsetEntry
  | FlowchartEntry
  | FlowBlockEntry
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

/** A spanning heading cell, as opposed to a plain string in a header row. */
export function isCellHeader(value: unknown): value is CellHeaderEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "cellHeader"
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
