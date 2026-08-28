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
  /** The same share in twelfths, as the books declare it. */
  share?: number;
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
      if (twelfths > 0) {
        parsed.width = `${((twelfths / 12) * 100).toFixed(4)}%`;
        parsed.share = twelfths;
      }
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

/* ------------------------------------------------------------------ *
 * Presentation profiles
 * ------------------------------------------------------------------ */

/**
 * The three shapes a table's layout tends to take, kept as names for the
 * combinations below rather than as the thing that decides them.
 *
 * - `reading` sits in the prose measure and flows with the page.
 * - `wide` breaks out into the main column's spare width on a large screen.
 * - `matrix` does that and adds a bounded two-axis viewport.
 */
export type TableProfile = "reading" | "wide" | "matrix";

/**
 * What a frame has to do, as separate answers.
 *
 * The first pass bundled all of this into the profile, and the tables that
 * broke were the ones where the bundle was wrong in one part: a table twenty
 * columns wide but five rows deep needs a column that stays put while you pan
 * and no vertical cap at all, and a table 113 rows deep but two columns wide
 * needs the opposite. Naming the decisions separately is what lets each one be
 * right on its own.
 */
export interface TablePresentation {
  /** Whether the table may reach past the measure into the column's spare width. */
  width: "measure" | "breakout";
  /** Whether it scrolls in a box of its own or runs down the page. */
  viewport: "flow" | "bounded";
  /**
   * Where the headings hold, if they hold at all. `viewport-sticky` pins them
   * to the top of a bounded box; `page-sticky` pins them under the top bar
   * while the page scrolls, which a bounded box cannot do and does not need.
   */
  header: "static" | "page-sticky" | "viewport-sticky";
  /** Whether the first column names its row, and so is that row's heading. */
  rowHeader: "none" | "first";
  /** Whether that heading stays put while the rest scrolls past it. */
  stickyRowHeader: boolean;
  /** The preset the answers line up with. Styling shorthand, not an input. */
  profile: TableProfile;
}

export interface TableShape {
  /** Columns after spans are applied, not the length of the widest row. */
  columns: number;
  /** Body rows, headers excluded. */
  rows: number;
  /** At least one header row carrying real text. */
  header?: boolean;
  /**
   * A heading names the first column, so that column identifies its rows.
   * Never inferred from position: the two activity-page word searches are
   * fifteen columns of single letters with no headings at all, and the first
   * letter of a row is not that row's name.
   */
  namesFirstColumn?: boolean;
  /**
   * Set by a renderer that knows the table's job where the shape alone would
   * mislead. A class progression is read as a grid at any size, and its `Level`
   * column identifies its rows whatever the headings say.
   */
  intent?: "progression";
  /**
   * An escape hatch for a table the rules get wrong. Rare by design: set it
   * beside a comment saying which table and why, and cover it with a test.
   * Never build a list of captions.
   */
  override?: TableProfile;
}

/**
 * The row count past which a table is looked things up in rather than read.
 *
 * Thirty-nine tables in the books are this long, thirteen of them in the DMG
 * and nine in Xanathar's, and twenty-nine of the thirty-nine are two columns
 * wide. They are magic item tables and encounter tables: you arrive with a
 * number and need the headings to still be there when you find the row.
 */
const LOOKUP_ROWS = 50;

/**
 * What a table's frame has to do, from its shape alone.
 *
 * Pure, so it can be tested against fixtures rather than measured in a browser,
 * and so the same table lays out the same way wherever it is rendered.
 *
 * **Declared column shares are deliberately not an input.** They were one in an
 * early draft, and measured over the books that rule classified 2,724 of 2,724
 * tables as `wide`: `colStyles` is carried by 2,705 of them, so it is a
 * constant rather than a signal. Column count divides the same population
 * 2,546 / 163 / 15, and the counts break cleanly at four — 2,236 tables have
 * two columns, 302 have three, 91 have four. Shares still set relative column
 * widths; they just no longer decide the frame as well.
 *
 * **Nor is row count, for the viewport.** Bounding a tall table was tried on
 * paper and would have put thirty-nine scroll boxes into the middle of
 * chapters — three of them stacked in the DMG's *Treasure* — to solve a problem
 * a heading that holds already solves.
 */
export function tablePresentation(shape: TableShape): TablePresentation {
  const progression = shape.intent === "progression";

  /*
   * A bounded box exists to hold row and column context still while the reader
   * moves between them, and a table earns one only if it has both to hold.
   *
   * A class progression never does, whatever its shape. Levels 1 to 20 are one
   * arc rather than a set of results to look something up in, and boxing them
   * puts the later levels away behind a second vertical gesture. The page owns
   * that axis, which costs the progression a sticky heading — twenty rows is
   * short enough for that to be the better trade.
   *
   * Nor does a table with no headings, which has no column context to hold. The
   * two activity-page word searches are fifteen columns of letters and no
   * header row, and being bounded capped them at 630px so that 21px of puzzle
   * could be scrolled to.
   */
  const matrix =
    !progression &&
    shape.columns >= 5 &&
    shape.rows >= 15 &&
    Boolean(shape.header);

  const bounded = shape.override ? shape.override === "matrix" : matrix;
  const wide = shape.override
    ? shape.override !== "reading"
    : progression || matrix || shape.columns >= 4;

  const width = wide ? "breakout" : "measure";
  const rowHeader = progression || shape.namesFirstColumn ? "first" : "none";

  return {
    width,
    viewport: bounded ? "bounded" : "flow",
    /*
     * A sticky heading needs a box that scrolls in the block axis, and the
     * horizontal wrapper a breakout table sits in is that box — `overflow-x:
     * auto` makes the other axis `auto` too, so a `thead` inside it holds
     * against a container that never scrolls. A table can have the wrapper or
     * a page-sticky heading, not both, so `page-sticky` is only ever offered to
     * a table that stays in the measure and needs no wrapper.
     */
    header: !shape.header
      ? "static"
      : bounded
        ? "viewport-sticky"
        : !wide && shape.rows >= LOOKUP_ROWS
          ? "page-sticky"
          : "static",
    rowHeader,
    // Inert unless something scrolls, so it needs no measuring to be safe.
    stickyRowHeader: rowHeader === "first" && width === "breakout",
    profile: bounded ? "matrix" : wide ? "wide" : "reading",
  };
}

/* ------------------------------------------------------------------ *
 * Naming
 * ------------------------------------------------------------------ */

/**
 * What a table's scroll region is called, once it turns out to scroll.
 *
 * Only a region that scrolls is announced, and then it needs a name that tells
 * it from the others: *Into Darkness* carries 25 tables and not one of them is
 * captioned, so the `Table` the first pass fell back to named all 25 the same.
 *
 * Every uncaptioned table in the books — 414 of them — sits inside a named
 * section, and only 59 share that section with another table, so the section is
 * the fallback that actually works. There is no ordinal below it: threading a
 * stable index through arbitrarily nested rendering would be real machinery for
 * names those 59 already have.
 *
 * Computed here, where the caption, the section and the headings all are, and
 * handed to the frame finished. The client side copies it and decides nothing.
 */
export function tableLabel(parts: {
  /** The table's own caption, which is the name it was printed with. */
  caption?: string;
  /** A name the renderer knows outright, like a class progression's. */
  explicit?: string;
  /** The nearest named section the table sits in. */
  section?: string;
  /** Column headings, for a table whose section holds more than one. */
  headings?: readonly (string | null | undefined)[];
}): string | undefined {
  const named = parts.caption?.trim() || parts.explicit?.trim();
  if (named) return withTable(named);

  const section = parts.section?.trim();
  if (!section) return undefined;

  const headings = (parts.headings ?? [])
    .map((heading) => heading?.trim())
    .filter((heading): heading is string => Boolean(heading));

  // Enough headings to tell two tables apart, few enough to say aloud.
  return headings.length > 0 && headings.length <= 3
    ? withTable(`${section} — ${headings.join(" and ")}`)
    : withTable(section);
}

/**
 * A region reads better as "Wilderness Encounters table" than as the bare
 * caption — but the books print plenty of captions that already say it, and
 * "Magic Item Table G table" is worse than either.
 */
function withTable(name: string): string {
  return /\btables?\b/i.test(name) ? name : `${name} table`;
}

/* ------------------------------------------------------------------ *
 * Column roles
 * ------------------------------------------------------------------ */

/**
 * What a column holds, which is what decides how narrow it may be squeezed.
 *
 * - `token` is one character: the letters of a word-search grid.
 * - `compact` is a die range, a bonus, a count — "01–07", "—", "+2".
 * - `label` is a word or two: a school, a size, a rarity.
 * - `rowHeader` names the row, and is set by the caller once row identity is
 *   established rather than read off the cells.
 * - `prose` is a sentence, and is the column that must not collapse.
 */
export type ColumnRole =
  | "token"
  | "compact"
  | "label"
  | "rowHeader"
  | "prose";

/**
 * The narrowest each role may be squeezed to, in rem.
 *
 * These replace a table-wide floor of `columns × 7.5rem`, which gave a die
 * column the same room as a sentence: Wilderness Encounters was held at 960px
 * so that nine columns of "01–07" could have 80px each, and overflowed a phone
 * by 612px to do it. A column now claims what its own content needs.
 *
 * Held as numbers because the prose floor is arithmetic on the others.
 */
export const COLUMN_MIN_REM: Record<ColumnRole, number> = {
  token: 2.5,
  compact: 3.25,
  label: 6,
  rowHeader: 8,
  prose: 12,
};

/** Digits, dashes, and the marks the books set beside them. */
const COMPACT_TEXT = /^[\s\d.,%*†+‒-―-]*$/;

/**
 * A column's role, from its cells and its printed share.
 *
 * Conservative on purpose: a column counts as compact only when *every* cell in
 * it is short and numeric, so one sentence anywhere in a column is enough to
 * keep it wide. Anything the renderer hands over as an object — an entry, a
 * link, a roll cell — is text as far as this is concerned and is measured by
 * the `text` the caller extracts for it.
 *
 * The printed share is the tiebreak rather than the signal. Nearly every table
 * declares one, so it says little on its own, but a column the book set at one
 * or two twelfths is not where a sentence was meant to go.
 */
export function columnRole(
  text: readonly (string | null)[],
  share?: number,
): ColumnRole {
  // A cell the caller could not read is not a die roll. An *empty* one is
  // simply a blank, and the books leave plenty of those in a column of ranges.
  const measurable = text.every((cell) => cell != null);
  const filled = text.filter((cell) => cell != null && cell !== "");

  if (measurable && filled.length > 0) {
    // Counted in code points, so an accented letter is still one character.
    if (filled.every((cell) => Array.from(cell!).length === 1)) return "token";

    if (filled.every((cell) => cell!.length <= 8 && COMPACT_TEXT.test(cell!))) {
      return "compact";
    }
  }

  return share != null && share <= 2 ? "label" : "prose";
}

/**
 * What each column may be squeezed to, as the CSS each cell carries.
 *
 * A prose column in a table that reaches past the measure gets its full floor:
 * there is room, and the floor is what keeps a sentence column from collapsing
 * to the width of the die column beside it.
 *
 * A prose column in a table held to the measure cannot have that, because the
 * floor is what was pushing tables off a phone. Two prose columns at 12rem
 * demand 24rem inside a 350px frame — 384px of table, and 34px of pointless
 * sideways travel that the content never asked for. Measured over the books,
 * 318 two-column tables and 154 three-column ones have that shape.
 *
 * So the floor is capped at what is actually left: the fixed columns are
 * budgeted at their own minimums, and the remainder is divided between the
 * prose columns. A flat cap was tried first and is wrong for the same reason
 * the flat floor is — 40% each suits exactly two prose columns and overflows at
 * three, and any fixed share can be eaten by the compact columns beside it.
 *
 * `100cqi` is the frame's own inline size, which is why the frame declares
 * itself an inline-size container. Padding and borders are inside these
 * numbers, since the reset sizes every box by its border box.
 */
/**
 * One role's own floor, as CSS.
 *
 * For a renderer that knows its columns outright and does not go through the
 * classifier — the class progression, whose `Features` column is prose in a
 * table that reaches past the measure. Only meaningful where there is room for
 * the floor; a table held to the measure has to divide what is left between its
 * prose columns, which takes the whole set and is `columnMinWidths` below.
 *
 * Exists so the value is shared rather than written twice. A second literal
 * would drift, and this is the column the role system was built around.
 */
export function columnMinWidth(role: ColumnRole): string {
  return `${COLUMN_MIN_REM[role]}rem`;
}

export function columnMinWidths(
  roles: readonly ColumnRole[],
  width: TablePresentation["width"],
): string[] {
  if (width === "breakout") {
    return roles.map(columnMinWidth);
  }

  const prose = roles.filter((role) => role === "prose").length;
  const budget = roles
    .filter((role) => role !== "prose")
    .reduce((total, role) => total + COLUMN_MIN_REM[role], 0);

  const share = budget
    ? `calc((100cqi - ${budget}rem) / ${prose})`
    : `calc(100cqi / ${prose})`;

  return roles.map((role) =>
    role === "prose"
      ? `min(${columnMinWidth("prose")}, ${share})`
      : columnMinWidth(role),
  );
}
