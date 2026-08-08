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

export type EntryObject =
  | EntriesEntry
  | ListEntry
  | ItemEntry
  | CellEntry
  | RowEntry
  | TableEntry
  | TableGroupEntry
  | QuoteEntry
  | InsetEntry
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
