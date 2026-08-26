import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { FacetOption } from "@/server/db/queries/facets";
import { BackgroundFilters } from "./background-filters";
import { FeatFilters } from "./feat-filters";

/**
 * The player-option rails.
 *
 * `spell-filters.test.tsx` holds the rail's general contract — the option list
 * never changes length, a dead option stops being a link, a selected one stays
 * one — and both of these render through the same `FilterOption`, so repeating
 * that here would assert the shared component twice more.
 *
 * What is specific to each rail, and what is checked here, is the wiring: which
 * query key an option toggles, and whether the reader is shown a word or a
 * code. Both are silent failures. A rail that writes `?skills=` where the page
 * reads `skill` renders perfectly and filters nothing.
 */

const option = <T extends string>(
  value: T,
  over: Partial<FacetOption<T>> = {},
): FacetOption<T> => ({
  value,
  count: 10,
  selected: false,
  disabled: false,
  ...over,
});

const href = (name: string | RegExp) =>
  screen.getByRole("link", { name }).getAttribute("href");

describe("the background rail", () => {
  it("toggles the key the list reads, and titles the stored skill name", () => {
    render(
      <BackgroundFilters
        params={{}}
        facets={{ skills: [option("stealth"), option("sleight of hand")] }}
      />,
    );

    expect(href(/^Stealth/)).toBe("/compendium/backgrounds?skill=stealth");
    // Stored lowercase, shown as the books set it — "of" stays down.
    expect(href(/^Sleight of Hand/)).toBe(
      "/compendium/backgrounds?skill=sleight+of+hand",
    );
  });

  it("drops a selected skill from the URL rather than adding it twice", () => {
    render(
      <BackgroundFilters
        params={{ skill: "stealth" }}
        facets={{ skills: [option("stealth", { selected: true })] }}
      />,
    );

    expect(href(/^Stealth/)).toBe("/compendium/backgrounds");
  });
});

describe("the feat rail", () => {
  it("names the ability and toggles its abbreviation", () => {
    render(
      <FeatFilters
        params={{}}
        facets={{
          abilities: [option("str"), option("dex")],
          open: option("open"),
        }}
      />,
    );

    expect(href(/^Strength/)).toBe("/compendium/feats?ability=str");
    expect(href(/^Dexterity/)).toBe("/compendium/feats?ability=dex");
  });

  /** A flag, not a value: the URL carries the key alone. */
  it("toggles the prerequisite flag", () => {
    render(
      <FeatFilters
        params={{}}
        facets={{ abilities: [option("str")], open: option("open") }}
      />,
    );

    expect(href(/^Nothing at all/)).toBe("/compendium/feats?open=1");
  });
});
