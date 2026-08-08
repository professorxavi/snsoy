import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/test/render";
import type { SpellRow } from "@/server/db/queries/spells";
import { SpellTable } from "./spell-table";

/**
 * The comparison table, given rows.
 *
 * Two things here are easy to break and impossible to see in a diff: the row
 * carries exactly one link rather than one per cell, and the columns that drop
 * out when the aside opens are the ones marked to. The rest is formatting,
 * covered where the formatters live — what is asserted below is that the table
 * reaches for the right one.
 */

const row = (over: Partial<SpellRow> = {}): SpellRow =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    name: "Fireball",
    slug: "fireball",
    sourceId: "PHB",
    level: 3,
    school: "V",
    isConcentration: false,
    isRitual: false,
    classes: ["Wizard", "Sorcerer"],
    time: [{ number: 1, unit: "action" }],
    range: { type: "point", distance: { type: "feet", amount: 150 } },
    components: { v: true, s: true, m: "a tiny ball of bat guano" },
    duration: [{ type: "instant" }],
    ...over,
  }) as SpellRow;

const bodyRows = () =>
  [...document.querySelectorAll("tbody tr")] as HTMLElement[];

describe("the spell table", () => {
  it("renders a row per spell", () => {
    render(
      <SpellTable
        rows={[row(), row({ id: "2", name: "Light", slug: "light" })]}
        params={{}}
      />,
    );

    expect(bodyRows()).toHaveLength(2);
  });

  /**
   * Nine identical links per row is unusable with a keyboard or a screen
   * reader, so the whole row is one anchor stretched by a pseudo-element.
   */
  it("gives a row exactly one link, pointing at the spell", () => {
    render(<SpellTable rows={[row()]} params={{}} />);

    const links = within(bodyRows()[0]!).getAllByRole("link");

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      "/compendium/spells/phb/fireball",
    );
    expect(links[0]).toHaveTextContent("Fireball");
  });

  describe("the level column", () => {
    it("writes a cantrip as C rather than 0", () => {
      render(<SpellTable rows={[row({ level: 0 })]} params={{}} />);

      expect(within(bodyRows()[0]!).getByText("C")).toBeInTheDocument();
    });

    it("writes every other level as its number", () => {
      render(<SpellTable rows={[row({ level: 9 })]} params={{}} />);

      expect(within(bodyRows()[0]!).getByText("9")).toBeInTheDocument();
    });
  });

  describe("markers beside the name", () => {
    it("flags concentration and ritual, spelled out for a reader", () => {
      render(
        <SpellTable
          rows={[row({ isConcentration: true, isRitual: true })]}
          params={{}}
        />,
      );

      const cell = bodyRows()[0]!;
      expect(within(cell).getByTitle("Concentration")).toHaveTextContent("C");
      expect(within(cell).getByTitle("Ritual")).toHaveTextContent("R");
    });

    it("leaves them off a spell that needs neither", () => {
      render(<SpellTable rows={[row()]} params={{}} />);

      expect(screen.queryByTitle("Concentration")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Ritual")).not.toBeInTheDocument();
    });

    /**
     * A cantrip that needs concentration shows C twice, for two different
     * reasons. Only the marker carries a title, which is what tells them apart.
     */
    it("does not confuse a cantrip's C with a concentration C", () => {
      render(
        <SpellTable
          rows={[row({ level: 0, isConcentration: true })]}
          params={{}}
        />,
      );

      const cell = bodyRows()[0]!;
      expect(within(cell).getAllByText("C")).toHaveLength(2);
      expect(within(cell).getAllByTitle("Concentration")).toHaveLength(1);
    });
  });

  describe("sorting", () => {
    it("marks the sorted column and offers the other", () => {
      render(<SpellTable rows={[row()]} params={{ sort: "level" }} />);

      const lvl = screen.getByRole("columnheader", { name: /Lvl/ });
      const name = screen.getByRole("columnheader", { name: /Name/ });

      expect(lvl).toHaveAttribute("aria-sort", "ascending");
      expect(name).not.toHaveAttribute("aria-sort");
    });

    /** No `sort` in the URL means name order, so Name is the marked column. */
    it("treats name as the default", () => {
      render(<SpellTable rows={[row()]} params={{}} />);

      expect(
        screen.getByRole("columnheader", { name: /Name/ }),
      ).toHaveAttribute("aria-sort", "ascending");
    });

    it("links each sortable header to its own sort, keeping the filters", () => {
      render(<SpellTable rows={[row()]} params={{ level: "3" }} />);

      expect(
        within(screen.getByRole("columnheader", { name: /Lvl/ })).getByRole(
          "link",
        ),
      ).toHaveAttribute("href", "/compendium/spells?level=3&sort=level");
    });
  });

  /**
   * The browse frame hides these with CSS when the aside opens. The CSS is a
   * browser's problem; that the right columns are marked is this table's.
   */
  it("marks the columns that drop out when the aside opens", () => {
    render(<SpellTable rows={[row()]} params={{}} />);

    const optional = [
      ...document.querySelectorAll("thead [data-col-optional]"),
    ].map((cell) => cell.textContent);

    expect(optional).toEqual(["Components", "Duration", "Classes"]);
  });

  it("marks the open spell's row as current", () => {
    render(
      <SpellTable
        rows={[row(), row({ id: "2", name: "Light", slug: "light" })]}
        params={{}}
        selectedSlug="light"
      />,
    );

    expect(bodyRows()[0]).not.toHaveAttribute("aria-current");
    expect(bodyRows()[1]).toHaveAttribute("aria-current", "true");
  });

  it("says so when nothing matched, rather than showing an empty table", () => {
    render(<SpellTable rows={[]} params={{}} />);

    expect(screen.getByText(/No spells match/i)).toBeInTheDocument();
    expect(document.querySelector("table")).toBeNull();
  });
});
