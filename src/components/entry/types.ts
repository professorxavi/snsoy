/**
 * The entry shapes the renderer handles.
 *
 * The source data defines roughly twenty entry types; these are the seven used
 * by spell and race text. Unhandled types render a visible fallback and report
 * themselves to the coverage report, which drives what gets added next.
 */

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

export interface TableEntry {
  type: "table";
  caption?: string;
  colLabels?: string[];
  /** Upstream layout hints: column widths and alignment, as class names. */
  colStyles?: string[];
  rows?: (Entry | CellEntry)[][];
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

export type EntryObject =
  | EntriesEntry
  | ListEntry
  | ItemEntry
  | CellEntry
  | TableEntry
  | QuoteEntry
  | InsetEntry
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
