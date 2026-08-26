import { describe, expect, it } from "vitest";
import type { FacetOption } from "@/server/db/queries/facets";
import type { MonsterFacetOptions } from "@/server/db/queries/monsters";
import { render, screen } from "@/test/render";
import { MonsterFilters } from "./monster-filters";

/**
 * The creature rail — which facets it offers, what it calls their values, and
 * which URL key each one writes.
 *
 * How an option *behaves* is not asserted here. Disabled options, selected
 * options and the fixed option count belong to `filter-rail`, which the spell
 * rail already covers against the same components; repeating them here would
 * duplicate the assertion without covering anything new.
 *
 * What is genuinely this rail's own is the translation: the books store a
 * size as "G" and an environment as "underdark", and neither is what anyone
 * browses by.
 */

const option = <T extends string>(
  value: T,
  over: Partial<FacetOption<T>> = {},
): FacetOption<T> => ({ value, count: 10, selected: false, disabled: false, ...over });

const facets = (over: Partial<MonsterFacetOptions> = {}): MonsterFacetOptions => ({
  crs: [option("0"), option("1/4"), option("17")],
  types: [option("dragon"), option("undead")],
  sizes: [option("T"), option("G")],
  environments: [option("underdark"), option("forest")],
  legendary: option("legendary"),
  spellcaster: option("spellcaster"),
  ...over,
});

const href = (name: string | RegExp) =>
  screen.getByRole("link", { name }).getAttribute("href");

describe("the creature filter rail", () => {
  it("names its groups", () => {
    render(<MonsterFilters params={{}} facets={facets()} />);

    for (const label of ["Challenge", "Type", "Size", "Environment", "Has"]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
  });

  /** Challenge leads: it is the question a DM arrives with. */
  it("puts challenge first", () => {
    render(<MonsterFilters params={{}} facets={facets()} />);

    expect(screen.getAllByRole("heading")[0]).toHaveTextContent("Challenge");
  });

  it("prints a rating exactly as the books do", () => {
    render(<MonsterFilters params={{}} facets={facets()} />);

    expect(screen.getByRole("link", { name: /1\/4/ })).toBeInTheDocument();
  });

  /** Nobody browses by "G". */
  it("spells out the size codes", () => {
    render(<MonsterFilters params={{}} facets={facets()} />);

    expect(screen.getByRole("link", { name: /Gargantuan/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tiny/ })).toBeInTheDocument();
  });

  it("capitalises the stored lowercase values", () => {
    render(<MonsterFilters params={{}} facets={facets()} />);

    expect(screen.getByRole("link", { name: /Underdark/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dragon/ })).toBeInTheDocument();
  });

  describe("the URL each group writes", () => {
    it("toggles its own key", () => {
      render(<MonsterFilters params={{}} facets={facets()} />);

      expect(href(/17/)).toBe("/compendium/monsters?cr=17");
      expect(href(/Dragon/)).toBe("/compendium/monsters?type=dragon");
      expect(href(/Gargantuan/)).toBe("/compendium/monsters?size=G");
      expect(href(/Underdark/)).toBe("/compendium/monsters?env=underdark");
      // Matched loosely: an option's accessible name runs its label into its
      // count, and the count is not what this is about.
      expect(href(/Legendary actions/)).toBe("/compendium/monsters?legendary=1");
      expect(href(/Spellcasting/)).toBe("/compendium/monsters?caster=1");
    });

    /** The size code goes in the URL, not the word — the column stores codes. */
    it("writes the stored value, not the printed one", () => {
      render(<MonsterFilters params={{}} facets={facets()} />);

      expect(href(/Tiny/)).toBe("/compendium/monsters?size=T");
    });

    it("keeps the other filters and drops the page", () => {
      render(
        <MonsterFilters
          params={{ type: "dragon", page: "3" }}
          facets={facets()}
        />,
      );

      expect(href(/17/)).toBe("/compendium/monsters?cr=17&type=dragon");
    });

    it("toggles a selected value back out", () => {
      render(
        <MonsterFilters
          params={{ cr: "17" }}
          facets={facets({ crs: [option("17", { selected: true })] })}
        />,
      );

      expect(href(/17/)).toBe("/compendium/monsters");
    });
  });

  /** Clearing is a filter operation; it must not also reorder the list. */
  it("keeps the sort when clearing the filters", () => {
    render(
      <MonsterFilters params={{ cr: "17", sort: "cr" }} facets={facets()} />,
    );

    expect(href("Clear filters")).toBe("/compendium/monsters?sort=cr");
  });
});
