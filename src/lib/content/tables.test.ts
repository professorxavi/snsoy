import { describe, expect, it } from "vitest";
import {
  captionForTableTag,
  columnMinWidths,
  columnStyles,
  tableLabel,
  parseColumnStyle,
  columnRole,
  tableAnchorId,
  tablePresentation,
} from "./tables";

/**
 * The hints are the only record of how a table was set, and they are read once,
 * here. What matters is that a width comes out as the share it stood for and
 * that the odd malformed class name is dropped rather than emitted as a width
 * of `NaN%`, which no browser reports and every column then ignores.
 */

describe("parseColumnStyle", () => {
  it("reads a whole-number width as its share of twelve", () => {
    expect(parseColumnStyle("col-4").width).toBe("33.3333%");
    expect(parseColumnStyle("col-12").width).toBe("100.0000%");
  });

  /** `col-2-5` is two and a half twelfths, not two hyphen five. */
  it("reads a fractional width", () => {
    expect(parseColumnStyle("col-2-5").width).toBe("20.8333%");
    expect(parseColumnStyle("col-0-6").width).toBe("5.0000%");
  });

  it("reads alignment and wrapping alongside a width", () => {
    expect(parseColumnStyle("col-1 text-center")).toEqual({
      width: "8.3333%",
      share: 1,
      align: "center",
    });
    expect(parseColumnStyle("col-2 text-right no-wrap")).toEqual({
      width: "16.6667%",
      share: 2,
      align: "end",
      noWrap: true,
    });
  });

  /**
   * The books carry a handful of typos — `text-enter`, `-text-right` — and
   * two columns declared `col-0`. A hint that cannot be honoured is no hint.
   */
  it("drops class names it does not recognise", () => {
    expect(parseColumnStyle("text-enter bold")).toEqual({});
    expect(parseColumnStyle("col-0")).toEqual({});
    expect(parseColumnStyle(undefined)).toEqual({});
    expect(parseColumnStyle("")).toEqual({});
  });
});

describe("columnStyles", () => {
  /**
   * Fifteen tables carry no hints at all, and others carry fewer than they have
   * columns. Either way the renderer needs one entry per column it will draw.
   */
  it("returns one entry per column, whatever the hints cover", () => {
    expect(columnStyles(["col-2"], 3)).toEqual([
      { width: "16.6667%", share: 2 },
      {},
      {},
    ]);
    expect(columnStyles(undefined, 2)).toEqual([{}, {}]);
    expect(columnStyles(["col-2", "col-10"], 1)).toEqual([
      { width: "16.6667%", share: 2 },
    ]);
  });
});

/**
 * A table is a position inside a chapter, not an entity, and the data hangs no
 * id on it — so the anchor is derived, and a link and the table it lands on
 * derive it from the same function. These pin the two halves of that rule.
 */
describe("captionForTableTag", () => {
  it("takes a plain caption as it stands", () => {
    expect(captionForTableTag("Magic Item Table C")).toBe("Magic Item Table C");
  });

  /**
   * The upstream index writes a qualified table as one name, while the table's
   * own caption is only the tail — `{"name": "Cyclops; Treasure Drops",
   * "caption": "Treasure Drops"}`. Taking the tail is what lets the lookup match
   * on caption alone, without working out where in a chapter a table sits.
   */
  it("drops the block a qualified table is named under", () => {
    expect(captionForTableTag("Cyclops; Treasure Drops")).toBe("Treasure Drops");
    expect(
      captionForTableTag("Artifact Properties; Minor Beneficial Properties"),
    ).toBe("Minor Beneficial Properties");
  });

  /** A colon is part of a caption, unlike a semicolon. */
  it("keeps a caption that only looks qualified", () => {
    expect(captionForTableTag("Treasure Hoard: Challenge 0-4")).toBe(
      "Treasure Hoard: Challenge 0-4",
    );
  });
});

describe("tableAnchorId", () => {
  it("prefixes, so it cannot collide with the ids an area points at", () => {
    expect(tableAnchorId("Magic Item Table C")).toBe("table-magic-item-table-c");
  });

  it("drops punctuation the books set captions with", () => {
    expect(tableAnchorId("Treasure Hoard: Challenge 0-4")).toBe(
      "table-treasure-hoard-challenge-0-4",
    );
    expect(tableAnchorId("Giants' Bags")).toBe("table-giants-bags");
  });

  it("still yields an anchor for a caption that is entirely punctuation", () => {
    expect(tableAnchorId("!?")).toBe("table-entry");
  });
});

/**
 * What a frame does is decided from the table's shape rather than from the page
 * it lands on. These pin the boundaries, the tables the design names as its
 * examples, and — the point of the second pass — that the four decisions are
 * answered one at a time rather than bundled.
 */
describe("tablePresentation", () => {
  it("keeps a short, narrow table in the reading measure", () => {
    // Port Nyanzaru Encounters: a d100 roll and a result.
    expect(tablePresentation({ columns: 2, rows: 11 })).toMatchObject({
      width: "measure",
      viewport: "flow",
      profile: "reading",
    });
  });

  it("keeps a narrow table reading however long it runs", () => {
    // Treasure Drops is 26 rows of two columns and is still prose.
    expect(tablePresentation({ columns: 2, rows: 26 }).profile).toBe("reading");
    expect(tablePresentation({ columns: 3, rows: 400 }).profile).toBe("reading");
  });

  it("widens at four columns", () => {
    // Omu Encounters.
    expect(tablePresentation({ columns: 4, rows: 21 }).width).toBe("breakout");
    expect(tablePresentation({ columns: 3, rows: 21 }).width).toBe("measure");
  });

  it("needs both width and height to bound a viewport", () => {
    const headed = { header: true };
    // Wilderness Encounters is 10 columns over 90 rows.
    expect(
      tablePresentation({ columns: 10, rows: 90, ...headed }).viewport,
    ).toBe("bounded");
    // Wide enough, but short enough to read whole.
    expect(
      tablePresentation({ columns: 10, rows: 14, ...headed }).viewport,
    ).toBe("flow");
    // Long, but narrow enough to keep its headings in view.
    expect(tablePresentation({ columns: 4, rows: 90, ...headed }).viewport).toBe(
      "flow",
    );
  });

  it("takes the boundaries as inclusive", () => {
    const headed = { header: true };
    expect(tablePresentation({ columns: 5, rows: 15, ...headed }).profile).toBe(
      "matrix",
    );
    expect(tablePresentation({ columns: 5, rows: 14, ...headed }).profile).toBe(
      "wide",
    );
    expect(tablePresentation({ columns: 4, rows: 15, ...headed }).profile).toBe(
      "wide",
    );
  });

  /**
   * A class progression takes the room a grid needs and none of the boxing.
   * Levels 1 to 20 are one arc, not a set of results, and every one of them has
   * to be on the page at once — so the page keeps the vertical axis, and the
   * progression gives up a sticky heading to keep it.
   */
  it("never bounds a progression, whatever its shape", () => {
    expect(
      tablePresentation({
        columns: 15,
        rows: 20,
        header: true,
        intent: "progression",
      }),
    ).toMatchObject({
      width: "breakout",
      viewport: "flow",
      header: "static",
      rowHeader: "first",
      stickyRowHeader: true,
    });

    // The same shape without the intent is exactly what a bounded matrix is.
    expect(
      tablePresentation({ columns: 15, rows: 20, header: true }).viewport,
    ).toBe("bounded");
  });

  it("gives a short progression the same room as a long one", () => {
    expect(
      tablePresentation({ columns: 2, rows: 3, intent: "progression" }),
    ).toMatchObject({ width: "breakout", viewport: "flow" });
  });

  it("lets an override win, since it exists for the table the rules miss", () => {
    expect(
      tablePresentation({ columns: 10, rows: 90, override: "reading" }).viewport,
    ).toBe("flow");
    expect(
      tablePresentation({
        columns: 2,
        rows: 2,
        intent: "progression",
        override: "wide",
      }).viewport,
    ).toBe("flow");
  });

  /**
   * Nearly every table in the books declares column shares — 2,705 of 2,724 —
   * so shares cannot decide the frame without making every table wide. They are
   * not an input here, and this is the test that says so.
   */
  it("ignores declared shares, which almost every table carries", () => {
    expect(tablePresentation({ columns: 2, rows: 11 }).width).toBe("measure");
  });

  describe("headers", () => {
    it("pins a bounded table's headings to its own viewport", () => {
      expect(
        tablePresentation({ columns: 10, rows: 90, header: true }).header,
      ).toBe("viewport-sticky");
    });

    /** Magic Item Table G: 88 rows of two columns, arrived at with a number. */
    it("pins a long measure table's headings to the page", () => {
      expect(
        tablePresentation({ columns: 2, rows: 88, header: true }).header,
      ).toBe("page-sticky");
      expect(
        tablePresentation({ columns: 2, rows: 49, header: true }).header,
      ).toBe("static");
    });

    /**
     * A page-sticky heading holds against the nearest box that scrolls, and the
     * wrapper a breakout table scrolls sideways in is one. Breakout wins; the
     * heading stays put in the flow. One table in the books is both.
     */
    it("gives a long breakout table no page-sticky heading", () => {
      expect(
        tablePresentation({ columns: 4, rows: 90, header: true }),
      ).toMatchObject({ width: "breakout", header: "static" });
    });

    it("never claims a heading a table does not have", () => {
      // The activity-page word searches: fifteen columns, no headings at all.
      expect(tablePresentation({ columns: 15, rows: 15 }).header).toBe("static");
      expect(tablePresentation({ columns: 2, rows: 88 }).header).toBe("static");
    });

    /**
     * A bounded box exists so the headings stay in view. With no headings there
     * is nothing to keep, and the word searches were capped at 630px so that
     * 21px of puzzle could be scrolled to.
     */
    it("does not bound a table it has no heading to pin", () => {
      expect(tablePresentation({ columns: 15, rows: 15 })).toMatchObject({
        width: "breakout",
        viewport: "flow",
      });
      expect(
        tablePresentation({ columns: 15, rows: 15, header: true }).viewport,
      ).toBe("bounded");
    });
  });

  describe("row identity", () => {
    it("takes a row header only where a heading names the first column", () => {
      expect(
        tablePresentation({ columns: 10, rows: 90, namesFirstColumn: true })
          .rowHeader,
      ).toBe("first");
      expect(tablePresentation({ columns: 10, rows: 90 }).rowHeader).toBe("none");
    });

    /** The first letter of a word-search row does not name that row. */
    it("does not manufacture one from the shape", () => {
      expect(
        tablePresentation({ columns: 15, rows: 15 }),
      ).toMatchObject({ rowHeader: "none", stickyRowHeader: false });
    });

    it("keeps Level as the progression's identity whatever the headings say", () => {
      expect(
        tablePresentation({ columns: 15, rows: 20, intent: "progression" }),
      ).toMatchObject({ rowHeader: "first", stickyRowHeader: true });
    });

    /**
     * The 20-column Multiple Monsters table is five rows deep, so it is never
     * bounded — but every column past the third is off the edge, and Character
     * Level has to stay put while you pan.
     */
    it("pins the identity of a short table too wide to see at once", () => {
      expect(
        tablePresentation({ columns: 20, rows: 5, namesFirstColumn: true }),
      ).toMatchObject({ viewport: "flow", stickyRowHeader: true });
    });

    it("leaves it unpinned where nothing can scroll past it", () => {
      expect(
        tablePresentation({ columns: 2, rows: 11, namesFirstColumn: true }),
      ).toMatchObject({ rowHeader: "first", stickyRowHeader: false });
    });
  });
});

/**
 * A column claims room according to what it holds. The rule it replaces gave a
 * die column the same budget as a sentence, which is how nine columns of
 * "01–07" came to hold Wilderness Encounters at 960px.
 */
describe("columnRole", () => {
  it("reads a column of die ranges as compact", () => {
    expect(columnRole(["01–07", "—", "01–11", "—"])).toBe("compact");
  });

  it("reads bonuses and counts as compact", () => {
    expect(columnRole(["+2", "+3", "+4"])).toBe("compact");
    expect(columnRole(["1", "10", "100"])).toBe("compact");
  });

  /** One sentence anywhere is enough to keep the whole column wide. */
  it("keeps a column prose when a single cell is prose", () => {
    expect(columnRole(["01", "02", "Roll twice and combine the results"])).toBe(
      "prose",
    );
  });

  it("treats an unmeasurable cell as prose rather than guessing", () => {
    // A link or a nested entry arrives as null; it is not a die roll.
    expect(columnRole(["01", null, "03"])).toBe("prose");
  });

  it("falls to the printed share when the text is not compact", () => {
    expect(columnRole(["Evocation", "Abjuration"], 2)).toBe("label");
    expect(columnRole(["Evocation", "Abjuration"], 6)).toBe("prose");
    expect(columnRole(["Evocation", "Abjuration"])).toBe("prose");
  });

  it("does not call an empty column compact", () => {
    expect(columnRole(["", "", ""])).toBe("prose");
    expect(columnRole([null, null], 1)).toBe("label");
  });

  /** Long numbers are still a sentence's worth of width. */
  it("stops calling a column compact once its values run long", () => {
    expect(columnRole(["1,000,000,000"])).toBe("prose");
  });

  /**
   * The two activity-page word searches are fifteen columns of single letters.
   * Read as prose they claimed 12rem each and rendered 2,880px wide, which is
   * the plainest thing the first pass got wrong.
   */
  it("reads a column of single characters as tokens", () => {
    expect(columnRole(["A", "B", "C"])).toBe("token");
    // Counted in code points, not UTF-16 units.
    expect(columnRole(["é", "ñ"])).toBe("token");
  });

  it("stops at a single character, letters or not", () => {
    expect(columnRole(["A", "BC"])).toBe("prose");
    expect(columnRole(["A", "", "C"])).toBe("token");
  });

  /** A digit is one character before it is a number, and either way it is narrow. */
  it("prefers token to compact where both would fit", () => {
    expect(columnRole(["1", "2", "6"])).toBe("token");
  });
});

/**
 * A region that scrolls is announced, so it needs a name that tells it from the
 * others. *Into Darkness* carries 25 tables and captions none of them.
 */
describe("tableLabel", () => {
  it("names a table after its caption", () => {
    expect(tableLabel({ caption: "Wilderness Encounters" })).toBe(
      "Wilderness Encounters table",
    );
  });

  it("does not say table twice", () => {
    expect(tableLabel({ caption: "Magic Item Table G" })).toBe(
      "Magic Item Table G",
    );
    expect(tableLabel({ caption: "Treasure Tables" })).toBe("Treasure Tables");
  });

  it("takes a name the renderer knows outright", () => {
    expect(tableLabel({ explicit: "Sorcerer progression" })).toBe(
      "Sorcerer progression table",
    );
  });

  it("falls to the section and its headings", () => {
    expect(
      tableLabel({ section: "Random Encounters", headings: ["d20", "Encounter"] }),
    ).toBe("Random Encounters — d20 and Encounter table");
  });

  it("drops the headings when there are too many to say", () => {
    expect(
      tableLabel({
        section: "Underdark Travel Times",
        headings: ["Location", "Velkynvelve", "Sloobludop", "Gracklstugh"],
      }),
    ).toBe("Underdark Travel Times table");
  });

  /** The activity-page word search: a section, and nothing else to go on. */
  it("falls to the section alone when a table has no headings", () => {
    expect(tableLabel({ section: "Word Find", headings: [null, ""] })).toBe(
      "Word Find table",
    );
  });

  it("gives no name at all rather than a generic one", () => {
    expect(tableLabel({})).toBeUndefined();
  });
});

/**
 * The prose floor is what keeps a sentence column from collapsing, and it was
 * also what pushed short tables off a phone. It survives where there is room
 * for it and is divided down where there is not.
 */
describe("columnMinWidths", () => {
  it("gives a breakout table's prose column its whole floor", () => {
    expect(columnMinWidths(["compact", "prose"], "breakout")).toEqual([
      "3.25rem",
      "12rem",
    ]);
  });

  it("caps a measure table's prose floor at what is left of the frame", () => {
    // One die column budgeted at 3.25rem, the rest to the single prose column.
    expect(columnMinWidths(["compact", "prose"], "measure")).toEqual([
      "3.25rem",
      "min(12rem, calc((100cqi - 3.25rem) / 1))",
    ]);
  });

  /**
   * The case a flat cap gets wrong. 154 reading tables in the books have three
   * prose columns; at 40% of the frame each they would ask for 120% of it.
   */
  it("divides the remainder between every prose column", () => {
    expect(columnMinWidths(["prose", "prose", "prose"], "measure")[0]).toBe(
      "min(12rem, calc(100cqi / 3))",
    );
    expect(columnMinWidths(["label", "prose", "prose"], "measure")[1]).toBe(
      "min(12rem, calc((100cqi - 6rem) / 2))",
    );
  });

  it("leaves a table with no prose column to its own minimums", () => {
    expect(columnMinWidths(["token", "token"], "measure")).toEqual([
      "2.5rem",
      "2.5rem",
    ]);
  });
});
