import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Entries } from "./entries";
import type { Entry } from "./types";

/**
 * Table markup, which is where a chapter's reference material lives.
 *
 * `tables.test.ts` proves a class name becomes the right share of the width;
 * what it cannot prove is that the share reaches the document. Widths only bind
 * to a column through a `<colgroup>`, so the failures this covers are the ones
 * that leave the page looking untouched: no column group emitted, one column
 * short of the row it describes, or the group written into a `<table>` that has
 * no hints to carry.
 */

const CLASSES: Entry = {
  type: "table",
  caption: "Classes",
  colLabels: ["Class", "Description", "Hit Die"],
  colStyles: ["col-1", "col-4", "col-1 text-center"],
  rows: [["Barbarian", "A fierce warrior", "d12"]],
};

const columns = () => [...document.querySelectorAll("col")];

describe("a table's declared column widths", () => {
  it("gives every column its printed share of the table", () => {
    render(<Entries entries={[CLASSES]} />);

    expect(columns().map((col) => col.style.width)).toEqual([
      "8.3333%",
      "33.3333%",
      "8.3333%",
    ]);
  });

  /**
   * A row wider than its hints is common enough to matter — a missing `<col>`
   * shifts every later width onto the wrong column.
   */
  it("covers the columns the rows actually have", () => {
    render(
      <Entries
        entries={[
          { type: "table", colStyles: ["col-2"], rows: [["a", "b", "c"]] },
        ]}
      />,
    );

    expect(columns()).toHaveLength(3);
  });

  it("writes no column group for a table that declares no widths", () => {
    render(
      <Entries entries={[{ type: "table", rows: [["a", "b"]] }]} />,
    );

    expect(columns()).toHaveLength(0);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
