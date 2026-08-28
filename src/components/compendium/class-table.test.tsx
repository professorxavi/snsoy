import { describe, expect, it } from "vitest";
import type { ProgressionColumn } from "@/lib/content/classes";
import { render, screen, within } from "@/test/render";
import { ClassTable } from "./class-table";
import { columnMinWidth } from "@/lib/content/tables";

/**
 * The class table's structure.
 *
 * `classes.test.ts` proves the columns carry the right values. What is left is
 * the grid they are laid into: twenty rows whatever the class supplies, and a
 * spanned heading that has to cover exactly the columns it names — a span one
 * out puts "Spell Slots per Spell Level" over the Features column and the
 * table still renders, perfectly formed and lying.
 */

const SLOTS: ProgressionColumn[] = [
  {
    label: "1st",
    group: "Spell Slots per Spell Level",
    values: Array.from({ length: 20 }, (_, i) => String(i + 1)),
  },
  {
    label: "2nd",
    group: "Spell Slots per Spell Level",
    values: Array(20).fill("—"),
  },
];

const CANTRIPS: ProgressionColumn = {
  label: "Cantrips Known",
  values: Array(20).fill("3"),
};

const rows = () => screen.getAllByRole("row");

/**
 * Everything in the row, its identity included.
 *
 * The level is a `rowheader` rather than a `cell` — it names the row, it is the
 * column that stays put while the rest scrolls, and a screen reader reads it
 * back with every value on the line.
 */
const cellsOf = (row: HTMLElement) => [
  ...within(row)
    .queryAllByRole("rowheader")
    .map((cell) => cell.textContent),
  ...within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent),
];

describe("the class table", () => {
  it("prints all twenty levels, whatever the class fills in", () => {
    render(
      <ClassTable
        columns={[]}
        rows={[{ level: 1, features: ["Rage"] }]}
        className="Barbarian"
      />,
    );

    const body = screen.getAllByRole("rowgroup")[1]!;
    expect(within(body).getAllByRole("row")).toHaveLength(20);
  });

  it("gives each level its proficiency bonus and the features gained", () => {
    render(
      <ClassTable
        columns={[]}
        rows={[
          { level: 1, features: ["Fighting Style", "Second Wind"] },
          { level: 5, features: ["Extra Attack"] },
        ]}
        className="Fighter"
      />,
    );

    expect(cellsOf(rows()[1]!)).toEqual([
      "1st",
      "+2",
      "Fighting Style, Second Wind",
    ]);
    expect(cellsOf(rows()[5]!)).toEqual(["5th", "+3", "Extra Attack"]);
    // A level that grants nothing is a dash, not an empty cell.
    expect(cellsOf(rows()[2]!)).toEqual(["2nd", "+2", "—"]);
  });

  /**
   * The three standard columns sit under a blank leading span, so the group's
   * own span starts where its columns do.
   */
  it("spans a group heading over exactly the columns it names", () => {
    render(
      <ClassTable
        columns={[CANTRIPS, ...SLOTS]}
        rows={[]}
        className="Wizard"
      />,
    );

    const spans = within(rows()[0]!)
      .getAllByRole("columnheader")
      .map((cell) => [cell.textContent, cell.getAttribute("colspan")]);

    // Three standard columns plus the ungrouped "Cantrips Known", then the pair.
    expect(spans).toEqual([
      ["", "4"],
      ["Spell Slots per Spell Level", "2"],
    ]);
  });

  it("writes no group row for a class whose columns have no headings", () => {
    render(
      <ClassTable columns={[CANTRIPS]} rows={[]} className="Sorcerer" />,
    );

    expect(
      within(rows()[0]!)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Level", "Bonus", "Features", "Cantrips Known"]);
  });
});

/**
 * The Features column is prose, and is given the floor prose is given.
 *
 * It is the one column here made of sentences, and it had none — so it took
 * whatever the compact columns left, about 113px on a phone, and set feature
 * names three lines deep. That makes the twenty-level progression far taller,
 * which is the one thing this table is not allowed to be.
 *
 * Asserted against the shared value rather than "12rem", because a second
 * literal here is exactly what would drift from the one the book tables use.
 */
describe("the features column's width", () => {
  const table = () =>
    render(
      <ClassTable
        columns={[CANTRIPS]}
        rows={[{ level: 1, features: ["Font of Magic"] }]}
        className="Sorcerer"
      />,
    );

  /*
   * The shared floor is declared in rem and reported in px. Sixteen is the
   * browser default root size rather than a value of ours, and converting here
   * is what lets the assertion name the shared constant instead of repeating
   * the number it holds — which is the whole point of the constant.
   */
  const floorInPx = `${Number.parseFloat(columnMinWidth("prose")) * 16}px`;

  // Level is a row header, so the cells after it are Bonus, Features, Cantrips.
  const featuresHeading = () => document.querySelector("thead th:nth-child(3)")!;
  const featuresCell = () => document.querySelector("tbody td:nth-child(3)")!;
  const bonusCell = () => document.querySelector("tbody td:nth-child(2)")!;

  it("gives the heading and its cells the shared prose floor", () => {
    table();
    expect(getComputedStyle(featuresHeading()).minWidth).toBe(floorInPx);
    expect(getComputedStyle(featuresCell()).minWidth).toBe(floorInPx);
  });

  /** And nothing else claims it: the compact columns stay content-sized. */
  it("leaves the compact columns without one", () => {
    table();

    expect(getComputedStyle(bonusCell()).minWidth).not.toBe(floorInPx);
  });
});
