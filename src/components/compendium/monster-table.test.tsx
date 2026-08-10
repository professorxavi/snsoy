import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MonsterRow } from "@/server/db/queries/monsters";
import { render, screen, within } from "@/test/render";
import { AsideProvider } from "./aside-context";
import { MonsterTable } from "./monster-table";

/**
 * The creature list.
 *
 * What is worth asserting is what the columns say when the data is awkward: a
 * creature with no rating, one that spans two sizes, one that lives everywhere.
 * The sort links and the aside wiring are the other half — both are pure URL
 * and prop construction, and both are invisible until something renders them.
 */

/**
 * Stands in for the bound `openEntityAside`. The real one is a server function
 * whose module opens a database connection at import time, which has no place
 * in a jsdom test — which is why the table takes it as a prop.
 */
const open = () => vi.fn(async () => null);

/** A row can only reach the aside from inside its provider. */
const renderTable = (ui: ReactElement) =>
  render(<AsideProvider>{ui}</AsideProvider>);

function row(overrides: Partial<MonsterRow> = {}): MonsterRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Adult Red Dragon",
    slug: "adult-red-dragon",
    sourceId: "MM",
    cr: 17,
    crDisplay: "17",
    creatureType: "dragon",
    sizes: ["H"],
    armorClass: 19,
    hitPointsAverage: 256,
    environments: ["mountain"],
    isLegendary: true,
    isSpellcaster: false,
    ...overrides,
  } as MonsterRow;
}

describe("MonsterTable", () => {
  it("prints a creature across its columns", () => {
    renderTable(<MonsterTable rows={[row()]} params={{}} open={open()} />);

    const cells = within(screen.getAllByRole("row")[1]!).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "Adult Red DragonL",
      "17",
      "dragon",
      "Huge",
      "19",
      "256",
      "mountain",
      "MM",
    ]);
  });

  /** The printed rating, never the sortable number — 0.25 is not a CR. */
  it("prints the rating as printed, not as stored", () => {
    renderTable(
      <MonsterTable
        rows={[row({ cr: 0.25, crDisplay: "1/4" })]}
        params={{}}
        open={open()}
      />,
    );

    expect(screen.getByText("1/4")).toBeInTheDocument();
    expect(screen.queryByText("0.25")).toBeNull();
  });

  it("dashes the columns a creature has no value for", () => {
    renderTable(
      <MonsterTable
        rows={[
          row({
            crDisplay: null,
            armorClass: null,
            hitPointsAverage: null,
            environments: null,
            sizes: null,
            creatureType: null,
          }),
        ]}
        params={{}}
        open={open()}
      />,
    );

    const cells = within(screen.getAllByRole("row")[1]!).getAllByRole("cell");
    expect(cells.slice(1).map((cell) => cell.textContent)).toEqual([
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "MM",
    ]);
  });

  it("names both sizes a creature may be", () => {
    renderTable(
      <MonsterTable rows={[row({ sizes: ["S", "M"] })]} params={{}} open={open()} />,
    );

    expect(screen.getByText("Small or Medium")).toBeInTheDocument();
  });

  /**
   * A handful of creatures list all eleven environments, which would set the
   * column's width for the 3,000 rows that list one or none.
   */
  it("caps the environment list and counts the rest", () => {
    renderTable(
      <MonsterTable
        rows={[row({ environments: ["arctic", "coastal", "desert", "forest"] })]}
        params={{}}
        open={open()}
      />,
    );

    expect(screen.getByText("arctic, coastal +2")).toBeInTheDocument();
  });

  /**
   * The common shape among named NPCs, and the one the naive rule gets exactly
   * backwards: seven of eleven environments printed as "arctic, desert +5"
   * reads as an arctic creature, and dozens of consecutive rows said it.
   */
  it("calls a creature of most environments a creature of any", () => {
    renderTable(
      <MonsterTable
        rows={[
          row({
            environments: [
              "arctic",
              "desert",
              "forest",
              "grassland",
              "hill",
              "mountain",
              "urban",
            ],
          }),
        ]}
        params={{}}
        open={open()}
      />,
    );

    expect(screen.getByText("any")).toBeInTheDocument();
    expect(screen.queryByText(/arctic/)).toBeNull();
  });

  it("marks the legendary and the spellcasters", () => {
    renderTable(
      <MonsterTable
        rows={[row({ isLegendary: true, isSpellcaster: true })]}
        params={{}}
        open={open()}
      />,
    );

    expect(screen.getByTitle("Legendary")).toHaveTextContent("L");
    expect(screen.getByTitle("Spellcaster")).toHaveTextContent("S");
  });

  it("leaves the markers off a creature with neither", () => {
    renderTable(
      <MonsterTable
        rows={[row({ isLegendary: false, isSpellcaster: false })]}
        params={{}}
        open={open()}
      />,
    );

    expect(screen.queryByTitle("Legendary")).toBeNull();
    expect(screen.queryByTitle("Spellcaster")).toBeNull();
  });

  describe("the name link", () => {
    /**
     * The creature's canonical URL, which is what all 15,887 inbound
     * `{@creature}` tags already point at. Nothing serves it — a creature
     * renders in the aside and has no page — but it is the entity's identity
     * and what "copy link address" should yield.
     */
    it("addresses the creature's canonical URL", () => {
      renderTable(<MonsterTable rows={[row()]} params={{}} open={open()} />);

      expect(
        screen.getByRole("link", { name: "Adult Red Dragon" }),
      ).toHaveAttribute("href", "/compendium/monsters/mm/adult-red-dragon");
    });
  });

  describe("sorting", () => {
    it("offers name and challenge as sorts", () => {
      renderTable(<MonsterTable rows={[row()]} params={{}} open={open()} />);

      expect(screen.getByRole("link", { name: /Name/ })).toHaveAttribute(
        "href",
        "/compendium/monsters?sort=name",
      );
      expect(screen.getByRole("link", { name: /CR/ })).toHaveAttribute(
        "href",
        "/compendium/monsters?sort=cr",
      );
    });

    /** Sorting must not drop the filters that produced the list. */
    it("keeps the filters and drops the page", () => {
      renderTable(
        <MonsterTable
          rows={[row()]}
          params={{ type: "dragon", page: "4" }}
          open={open()}
        />,
      );

      expect(screen.getByRole("link", { name: /CR/ })).toHaveAttribute(
        "href",
        "/compendium/monsters?sort=cr&type=dragon",
      );
    });

    it("marks the active sort on its header cell", () => {
      renderTable(<MonsterTable rows={[row()]} params={{ sort: "cr" }} open={open()} />);

      const headers = screen.getAllByRole("columnheader");
      const cr = headers.find((h) => h.textContent?.startsWith("CR"));
      expect(cr).toHaveAttribute("aria-sort", "ascending");
    });

    /** Name is the default, so a bare URL still shows a sorted column. */
    it("treats name as the sort when the URL names none", () => {
      renderTable(<MonsterTable rows={[row()]} params={{}} open={open()} />);

      const headers = screen.getAllByRole("columnheader");
      const name = headers.find((h) => h.textContent?.startsWith("Name"));
      expect(name).toHaveAttribute("aria-sort", "ascending");
    });
  });

  it("says so when the filters match nothing", () => {
    renderTable(<MonsterTable rows={[]} params={{ q: "zzz" }} open={open()} />);

    expect(
      screen.getByText("No creatures match these filters."),
    ).toBeInTheDocument();
  });
});
