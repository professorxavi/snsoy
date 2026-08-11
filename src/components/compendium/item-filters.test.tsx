import { describe, expect, it } from "vitest";
import type { FacetOption } from "@/server/db/queries/facets";
import type { ItemCategory, ItemFacetOptions } from "@/server/db/queries/items";
import { render, screen, within } from "@/test/render";
import { ItemFilters } from "./item-filters";

/**
 * The item rail — which facets it offers, what it calls their values, and which
 * URL key each one writes.
 *
 * How an option *behaves* is not asserted here. Disabled options, selected
 * options and the fixed option count belong to `filter-rail`, which the spell
 * rail already covers against the same components.
 *
 * What is genuinely this rail's own is the translation: the corpus stores a
 * type as "HA" and a category as an entity type, and neither is what anyone
 * browses by. The URL keeps the stored value so a filtered link survives a
 * change of wording — which only holds if the label and the value can differ,
 * so both halves are pinned.
 */

const option = <T extends string>(
  value: T,
  over: Partial<FacetOption<T>> = {},
): FacetOption<T> => ({ value, count: 10, selected: false, disabled: false, ...over });

const facets = (over: Partial<ItemFacetOptions> = {}): ItemFacetOptions => ({
  rarities: [option("none"), option("rare"), option("very rare")],
  types: [
    option("HA", { label: "Heavy Armor" }),
    option("WON", { label: "Wondrous Item" }),
  ],
  categories: [
    option<ItemCategory>("item", { label: "Magic items" }),
    option<ItemCategory>("baseitem", { label: "Equipment" }),
  ],
  attunement: option("attunement"),
  magic: option("magic"),
  ...over,
});

const href = (name: string | RegExp) =>
  screen.getByRole("link", { name }).getAttribute("href");

describe("the item filter rail", () => {
  it("names its groups", () => {
    render(<ItemFilters params={{}} facets={facets()} />);

    for (const label of ["Rarity", "Category", "Type", "Has"]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
  });

  /** Rarity leads: it is the question someone arrives with. */
  it("puts rarity first", () => {
    render(<ItemFilters params={{}} facets={facets()} />);

    expect(screen.getAllByRole("heading")[0]).toHaveTextContent("Rarity");
  });

  it("capitalises the stored lowercase rarities", () => {
    render(<ItemFilters params={{}} facets={facets()} />);

    expect(screen.getByRole("link", { name: /Very rare/ })).toBeInTheDocument();
  });

  /** Nobody browses by "HA", and nobody browses by "baseitem" either. */
  it("prints the label the facet carries, not its stored code", () => {
    render(<ItemFilters params={{}} facets={facets()} />);

    expect(screen.getByRole("link", { name: /Heavy Armor/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Equipment/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^HA/ })).toBeNull();
  });

  describe("the URL each group writes", () => {
    it("toggles its own key", () => {
      render(<ItemFilters params={{}} facets={facets()} />);

      expect(href(/Very rare/)).toBe("/compendium/items?rarity=very+rare");
      expect(href(/Equipment/)).toBe("/compendium/items?category=baseitem");
      expect(href(/Heavy Armor/)).toBe("/compendium/items?type=HA");
      // Matched loosely: an option's accessible name runs its label into its
      // count, and the count is not what this is about.
      expect(href(/Attunement/)).toBe("/compendium/items?attunement=1");

      // Scoped to its own group: the "Magic" flag and the "Magic items"
      // category are two different filters whose names overlap.
      const has = within(
        screen.getByRole("heading", { name: "Has" }).closest("section")!,
      );
      expect(
        has.getByRole("link", { name: /Magic/ }).getAttribute("href"),
      ).toBe("/compendium/items?magic=1");
    });

    /** The abbreviation goes in the URL, not the word the rail shows. */
    it("writes the stored value, not the printed one", () => {
      render(<ItemFilters params={{}} facets={facets()} />);

      expect(href(/Wondrous Item/)).toBe("/compendium/items?type=WON");
    });

    it("keeps the other filters and drops the page", () => {
      render(
        <ItemFilters params={{ rarity: "rare", page: "3" }} facets={facets()} />,
      );

      expect(href(/Heavy Armor/)).toBe("/compendium/items?rarity=rare&type=HA");
    });

    it("toggles a selected value back out", () => {
      render(
        <ItemFilters
          params={{ rarity: "rare" }}
          facets={facets({ rarities: [option("rare", { selected: true })] })}
        />,
      );

      expect(href(/Rare/)).toBe("/compendium/items");
    });
  });

  /** Clearing is a filter operation; it must not also reorder the list. */
  it("keeps the sort when clearing the filters", () => {
    render(
      <ItemFilters params={{ rarity: "rare", sort: "value" }} facets={facets()} />,
    );

    expect(href("Clear filters")).toBe("/compendium/items?sort=value");
  });
});
