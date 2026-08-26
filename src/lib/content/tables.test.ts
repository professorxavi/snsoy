import { describe, expect, it } from "vitest";
import { columnStyles, parseColumnStyle } from "./tables";

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
      align: "center",
    });
    expect(parseColumnStyle("col-2 text-right no-wrap")).toEqual({
      width: "16.6667%",
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
    expect(columnStyles(["col-2"], 3)).toEqual([{ width: "16.6667%" }, {}, {}]);
    expect(columnStyles(undefined, 2)).toEqual([{}, {}]);
    expect(columnStyles(["col-2", "col-10"], 1)).toEqual([
      { width: "16.6667%" },
    ]);
  });
});
