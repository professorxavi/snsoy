import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ItemRow } from "@/server/db/queries/items";
import { render, screen, within } from "@/test/render";
import { AsideProvider } from "./aside-context";
import { ItemTable } from "./item-table";

/**
 * The item list.
 *
 * What is worth asserting is what the columns say when the data is awkward: an
 * item with no price, one whose rarity is a non-rating, one from each of the
 * three entity types. The last is the load-bearing one — the whole list is a
 * blend of three types, and each row has to address its own URL segment or the
 * blend leaks into the route map.
 */

/**
 * Stands in for `openEntityAside`. The real one is a server function whose
 * module opens a database connection at import time, which has no place in a
 * jsdom test — which is why the table takes it as a prop.
 */
const open = () => vi.fn(async () => null);

/** A row can only reach the aside from inside its provider. */
const renderTable = (ui: ReactElement) =>
  render(<AsideProvider>{ui}</AsideProvider>);

function row(overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Longsword",
    slug: "longsword",
    sourceId: "PHB",
    entityType: "baseitem",
    typeCode: "M",
    typeName: "Melee Weapon",
    rarity: "none",
    requiresAttunement: false,
    isMagic: false,
    valueCp: 1500,
    weightLb: 3,
    ...overrides,
  } as ItemRow;
}

describe("ItemTable", () => {
  it("prints an item across its columns", () => {
    renderTable(<ItemTable rows={[row()]} params={{}} open={open()} />);

    const cells = within(screen.getAllByRole("row")[1]!).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "Longsword",
      "Melee Weapon",
      "—",
      "15 gp",
      "3 lb.",
      "PHB",
    ]);
  });

  /** Copper is how it is stored; gold is how the equipment table prints it. */
  it("prints a price in the largest coin that divides it", () => {
    renderTable(
      <ItemTable rows={[row({ valueCp: 50 })]} params={{}} open={open()} />,
    );

    expect(screen.getByText("5 sp")).toBeInTheDocument();
  });

  it("dashes the columns an item has no value for", () => {
    renderTable(
      <ItemTable
        rows={[row({ typeName: null, rarity: null, valueCp: null, weightLb: null })]}
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
      "PHB",
    ]);
  });

  it("marks the items that need attuning", () => {
    renderTable(
      <ItemTable
        rows={[row({ requiresAttunement: true })]}
        params={{}}
        open={open()}
      />,
    );

    expect(screen.getByTitle("Requires attunement")).toHaveTextContent("A");
  });

  it("leaves the marker off an item that needs none", () => {
    renderTable(<ItemTable rows={[row()]} params={{}} open={open()} />);

    expect(screen.queryByTitle("Requires attunement")).toBeNull();
  });

  describe("the name link", () => {
    /**
     * The point of blending two entity types in one list: each row addresses
     * the segment for its own type, so the list can mix them while the URL
     * scheme keeps one segment to one type.
     */
    it("addresses each type's own canonical URL", () => {
      renderTable(
        <ItemTable
          rows={[
            row({ id: "1", name: "Longsword", entityType: "baseitem" }),
            row({
              id: "2",
              name: "+1 Longsword",
              slug: "1-longsword",
              sourceId: "DMG",
              entityType: "item",
            }),
          ]}
          params={{}}
          open={open()}
        />,
      );

      expect(screen.getByRole("link", { name: "Longsword" })).toHaveAttribute(
        "href",
        "/compendium/base-items/phb/longsword",
      );
      expect(screen.getByRole("link", { name: "+1 Longsword" })).toHaveAttribute(
        "href",
        "/compendium/items/dmg/1-longsword",
      );
    });
  });

  describe("sorting", () => {
    it("offers name, rarity and cost as sorts", () => {
      renderTable(<ItemTable rows={[row()]} params={{}} open={open()} />);

      expect(screen.getByRole("link", { name: /Name/ })).toHaveAttribute(
        "href",
        "/compendium/items?sort=name",
      );
      expect(screen.getByRole("link", { name: /Rarity/ })).toHaveAttribute(
        "href",
        "/compendium/items?sort=rarity",
      );
      expect(screen.getByRole("link", { name: /Cost/ })).toHaveAttribute(
        "href",
        "/compendium/items?sort=value",
      );
    });

    /** Sorting must not drop the filters that produced the list. */
    it("keeps the filters and drops the page", () => {
      renderTable(
        <ItemTable
          rows={[row()]}
          params={{ rarity: "rare", page: "4" }}
          open={open()}
        />,
      );

      expect(screen.getByRole("link", { name: /Rarity/ })).toHaveAttribute(
        "href",
        "/compendium/items?rarity=rare&sort=rarity",
      );
    });

    it("marks the active sort on its header cell", () => {
      renderTable(
        <ItemTable rows={[row()]} params={{ sort: "value" }} open={open()} />,
      );

      const cost = screen
        .getAllByRole("columnheader")
        .find((header) => header.textContent?.startsWith("Cost"));
      expect(cost).toHaveAttribute("aria-sort", "ascending");
    });

    /** Name is the default, so a bare URL still shows a sorted column. */
    it("treats name as the sort when the URL names none", () => {
      renderTable(<ItemTable rows={[row()]} params={{}} open={open()} />);

      const name = screen
        .getAllByRole("columnheader")
        .find((header) => header.textContent?.startsWith("Name"));
      expect(name).toHaveAttribute("aria-sort", "ascending");
    });
  });

  it("says so when the filters match nothing", () => {
    renderTable(<ItemTable rows={[]} params={{ q: "zzz" }} open={open()} />);

    expect(screen.getByText("No items match these filters.")).toBeInTheDocument();
  });
});
