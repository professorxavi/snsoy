/**
 * Reading a table's upstream layout hints.
 *
 * Every table in the corpus carries a `colStyles` array of CSS class names
 * borrowed from a twelve-column grid: `["col-1", "col-4", "col-1 text-center"]`.
 * They are the only record of how a table was set on the printed page, and
 * without them a browser sizes columns by content alone — which puts a
 * one-word column and a sentence column at nearly the same width and pushes
 * the rest off the edge.
 *
 * The vocabulary is small and stable across all 2,776 tables that carry it:
 * a width, an alignment, and a wrapping flag. Anything else is ignored.
 */

export interface ColumnStyle {
  /** Share of the table's width, as a CSS percentage. Absent if unstated. */
  width?: string;
  /** Cell alignment. `start` is the default and is never returned. */
  align?: "center" | "end";
  /** The column asked not to wrap. */
  noWrap?: boolean;
}

/**
 * `col-4` is four twelfths of the table; `col-2-5` is two and a half. The
 * fraction is a single digit after the hyphen, so `col-0-6` is a hair's
 * breadth — used for a die column beside eleven columns of level progression.
 */
const WIDTH = /^col-(\d+)(?:-(\d))?$/;

/** One column's hints. Unrecognised class names are dropped. */
export function parseColumnStyle(style: string | undefined): ColumnStyle {
  const parsed: ColumnStyle = {};

  for (const token of style?.trim().split(/\s+/) ?? []) {
    const width = WIDTH.exec(token);

    if (width) {
      const twelfths = Number(width[1]) + Number(width[2] ?? 0) / 10;
      // `col-0` appears twice in the corpus and means nothing renderable.
      if (twelfths > 0) parsed.width = `${((twelfths / 12) * 100).toFixed(4)}%`;
      continue;
    }

    if (token === "text-center") parsed.align = "center";
    else if (token === "text-right") parsed.align = "end";
    else if (token === "no-wrap") parsed.noWrap = true;
  }

  return parsed;
}

/**
 * One entry per column, padded to `columns` so a table whose hints are shorter
 * than its widest row still gets a `<col>` for every column it renders.
 */
export function columnStyles(
  colStyles: string[] | undefined,
  columns: number,
): ColumnStyle[] {
  return Array.from({ length: columns }, (_, index) =>
    parseColumnStyle(colStyles?.[index]),
  );
}
