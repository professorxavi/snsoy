/**
 * Reading a table's upstream layout hints.
 *
 * Every table in the books carries a `colStyles` array of CSS class names
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
      // `col-0` appears twice in the books and means nothing renderable.
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

/* ------------------------------------------------------------------ *
 * Anchors
 * ------------------------------------------------------------------ */

/**
 * The caption a `{@table}` tag names.
 *
 * Most tags name a caption outright. Some qualify it with the block it sits
 * under — `{@table Artifact Properties; Minor Beneficial Properties|DMG}`,
 * `{@table Cyclops; Treasure Drops|ToA}` — which the upstream index writes as
 * one name while the table's own caption is only the part after the semicolon.
 * Taking the tail is what lets a lookup match on the caption alone, without
 * reconstructing where in a chapter the table sits.
 */
export function captionForTableTag(name: string): string {
  const split = name.lastIndexOf("; ");
  return split === -1 ? name : name.slice(split + 2);
}

/**
 * The anchor a table is reachable at, derived from its caption.
 *
 * A table is a position inside a chapter rather than an entity, and unlike an
 * `{@area}` the data hangs no `id` on it — so the anchor has to be derived, and
 * both ends have to derive it the same way. The one function is used by the
 * link and by the table it lands on; nothing else may reproduce the rule.
 *
 * Prefixed because the same document also carries the ids `{@area}` points at,
 * which are the data's own and unprefixed.
 */
export function tableAnchorId(caption: string): string {
  const slug = caption
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `table-${slug || "entry"}`;
}
