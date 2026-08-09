import { describe, expect, it } from "vitest";
import type { ProgressionColumn } from "@/lib/content/classes";
import { render, screen, within } from "@/test/render";
import { ClassTable } from "./class-table";

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

const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);

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
