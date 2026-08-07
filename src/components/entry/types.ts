/**
 * The shapes corpus prose actually arrives in.
 *
 * The corpus defines roughly twenty entry types across all content. These are
 * the seven that spell text uses, measured across all 525 spells rather than
 * assumed: `entries` (317), `list` (33), `cell` (29), `table` (14), `item` (6),
 * `quote` (3), `inset` (1) — plus bare strings, which are the overwhelming
 * majority of the text.
 *
 * Building only these is deliberate. Phase 4 grows by measurement: an unhandled
 * type renders a visible fallback and reports itself, and that report decides
 * what gets built next rather than a guess at the long tail.
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

/**
 * A table cell that carries a die roll rather than text — the left-hand column
 * of every random table. `exact` is a single result, `min`/`max` a span.
 */
export interface CellEntry {
  type: "cell";
  roll?: {
    exact?: number;
    min?: number;
    max?: number;
    /** Pad to the table's width: 1 becomes "01" when the table runs to 100. */
    pad?: boolean;
  };
}

export interface TableEntry {
  type: "table";
  caption?: string;
  colLabels?: string[];
  /** Corpus layout hints — column widths and alignment, as class-name strings. */
  colStyles?: string[];
  rows?: (Entry | CellEntry)[][];
}

export interface QuoteEntry {
  type: "quote";
  entries?: Entry[];
  by?: string;
  from?: string;
}

/** A sidebar. `insetReadaloud` is the boxed text a DM reads to the table. */
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

/** Cells are the one entry type that only ever appears inside a table row. */
export function isCell(value: unknown): value is CellEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "cell"
  );
}
