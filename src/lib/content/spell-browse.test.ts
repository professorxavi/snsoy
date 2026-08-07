import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  facetOptions,
  filterSpells,
  filtersFromSearch,
  filtersToQuery,
  matchesSpell,
  sortSpells,
  toggle,
  type BrowsableSpell,
  type SpellFilterState,
} from "./spell-browse";

const spell = (
  name: string,
  overrides: Partial<BrowsableSpell> = {},
): BrowsableSpell => ({
  name,
  level: 1,
  school: "V",
  castingTimeUnit: "action",
  isConcentration: false,
  isRitual: false,
  classes: ["wizard"],
  ...overrides,
});

const withFilters = (overrides: Partial<SpellFilterState>): SpellFilterState => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

const CORPUS: BrowsableSpell[] = [
  spell("Fireball", { level: 3, school: "V", classes: ["sorcerer", "wizard"] }),
  spell("Bless", {
    level: 1,
    school: "A",
    isConcentration: true,
    classes: ["cleric"],
  }),
  spell("Alarm", {
    level: 1,
    school: "A",
    isRitual: true,
    castingTimeUnit: "minute",
    classes: ["ranger", "wizard"],
  }),
  spell("Shield", {
    level: 1,
    school: "A",
    castingTimeUnit: "reaction",
    classes: ["wizard"],
  }),
  spell("Light", { level: 0, school: "V", classes: ["cleric", "wizard"] }),
];

describe("matchesSpell", () => {
  it("treats an empty group as no constraint", () => {
    expect(matchesSpell(spell("X"), EMPTY_FILTERS)).toBe(true);
  });

  it("matches any selected value within a group", () => {
    const filters = withFilters({ levels: [1, 3] });
    expect(matchesSpell(spell("X", { level: 3 }), filters)).toBe(true);
    expect(matchesSpell(spell("X", { level: 2 }), filters)).toBe(false);
  });

  /** Selecting bard and cleric means "either can cast it", not "both". */
  it("matches a class if any selected class can cast it", () => {
    const filters = withFilters({ classes: ["bard", "cleric"] });
    expect(matchesSpell(spell("X", { classes: ["cleric"] }), filters)).toBe(true);
    expect(matchesSpell(spell("X", { classes: ["druid"] }), filters)).toBe(false);
  });

  it("searches names case-insensitively on a substring", () => {
    const filters = withFilters({ q: "BALL" });
    expect(matchesSpell(spell("Fireball"), filters)).toBe(true);
    expect(matchesSpell(spell("Shield"), filters)).toBe(false);
  });

  it("ignores surrounding whitespace in a search", () => {
    expect(matchesSpell(spell("Fireball"), withFilters({ q: "  fire " }))).toBe(
      true,
    );
  });

  /** Facet counting needs every filter except the one being counted. */
  it("can skip a single group", () => {
    const filters = withFilters({ levels: [9] });
    expect(matchesSpell(spell("X", { level: 1 }), filters)).toBe(false);
    expect(matchesSpell(spell("X", { level: 1 }), filters, "levels")).toBe(true);
  });
});

describe("filterSpells", () => {
  it("applies every group at once", () => {
    const found = filterSpells(
      CORPUS,
      withFilters({ levels: [1], schools: ["A"], classes: ["wizard"] }),
    );
    expect(found.map((s) => s.name)).toEqual(["Alarm", "Shield"]);
  });

  it("returns nothing when the combination is impossible", () => {
    expect(filterSpells(CORPUS, withFilters({ levels: [9] }))).toEqual([]);
  });
});

describe("sortSpells", () => {
  it("sorts by name by default", () => {
    expect(sortSpells(CORPUS, "name").map((s) => s.name)).toEqual([
      "Alarm",
      "Bless",
      "Fireball",
      "Light",
      "Shield",
    ]);
  });

  /** A level column full of 1s in arbitrary order is not usefully sorted. */
  it("breaks level ties by name", () => {
    expect(sortSpells(CORPUS, "level").map((s) => s.name)).toEqual([
      "Light",
      "Alarm",
      "Bless",
      "Shield",
      "Fireball",
    ]);
  });

  it("does not mutate its input", () => {
    const before = CORPUS.map((s) => s.name);
    sortSpells(CORPUS, "level");
    expect(CORPUS.map((s) => s.name)).toEqual(before);
  });
});

describe("facetOptions", () => {
  /**
   * The rule the rail is built on: options never appear or disappear, they only
   * become unavailable. A rail that rearranges as you filter cannot be learned,
   * and a vanished option is indistinguishable from one that never existed.
   */
  it("keeps every option in the domain no matter what is filtered", () => {
    const unfiltered = facetOptions(CORPUS, EMPTY_FILTERS);
    const narrowed = facetOptions(CORPUS, withFilters({ levels: [3] }));

    expect(narrowed.schools.map((f) => f.value)).toEqual(
      unfiltered.schools.map((f) => f.value),
    );
    expect(narrowed.classes.map((f) => f.value)).toEqual(
      unfiltered.classes.map((f) => f.value),
    );
  });

  it("disables an option that would return nothing", () => {
    // Only Fireball is 3rd level, and it is Evocation cast by sorcerer/wizard.
    const facets = facetOptions(CORPUS, withFilters({ levels: [3] }));

    const abjuration = facets.schools.find((f) => f.value === "A");
    expect(abjuration).toMatchObject({ count: 0, disabled: true });

    const evocation = facets.schools.find((f) => f.value === "V");
    expect(evocation).toMatchObject({ count: 1, disabled: false });

    const cleric = facets.classes.find((f) => f.value === "cleric");
    expect(cleric).toMatchObject({ count: 0, disabled: true });
  });

  /**
   * Otherwise a filter that narrows to nothing could never be undone from the
   * rail — the only way out would be Clear filters or the back button.
   */
  it("leaves a selected option enabled even at zero", () => {
    const facets = facetOptions(
      CORPUS,
      withFilters({ levels: [3], schools: ["A"] }),
    );
    const abjuration = facets.schools.find((f) => f.value === "A");
    expect(abjuration).toMatchObject({ count: 0, selected: true, disabled: false });
  });

  /** A group counted against itself would zero out its own alternatives. */
  it("counts a facet against the other filters but not its own", () => {
    const facets = facetOptions(CORPUS, withFilters({ schools: ["V"] }));

    // Abjuration is still offered with its real count, despite Evocation being
    // the active selection — otherwise you could never switch schools.
    expect(facets.schools.find((f) => f.value === "A")).toMatchObject({
      count: 3,
      disabled: false,
    });
  });

  it("orders casting times by the action economy, not alphabetically", () => {
    const facets = facetOptions(CORPUS, EMPTY_FILTERS);
    expect(facets.times.map((f) => f.value)).toEqual([
      "action",
      "reaction",
      "minute",
    ]);
  });

  it("counts the concentration and ritual flags", () => {
    const facets = facetOptions(CORPUS, EMPTY_FILTERS);
    expect(facets.concentration.count).toBe(1);
    expect(facets.ritual.count).toBe(1);
  });
});

describe("URL round-trip", () => {
  it("restores the state it serialised", () => {
    const filters = withFilters({
      levels: [1, 3],
      schools: ["V"],
      times: ["action"],
      classes: ["wizard"],
      concentration: true,
      ritual: true,
      q: "fire",
      sort: "level",
    });

    expect(filtersFromSearch(new URLSearchParams(filtersToQuery(filters)))).toEqual(
      filters,
    );
  });

  it("omits defaults so a clean view has a clean URL", () => {
    expect(filtersToQuery(EMPTY_FILTERS)).toBe("");
    expect(filtersToQuery(withFilters({ sort: "name" }))).toBe("");
  });

  /**
   * One filter state, one URL — otherwise the same view produces different
   * links depending on the order the reader happened to click things.
   */
  it("is stable regardless of which filter was set first", () => {
    const a = withFilters({ schools: ["V"], levels: [3] });
    const b = withFilters({ levels: [3], schools: ["V"] });
    expect(filtersToQuery(a)).toBe(filtersToQuery(b));
    expect(filtersToQuery(a)).toBe("?level=3&school=V");
  });

  it("ignores junk in the URL rather than producing NaN", () => {
    const filters = filtersFromSearch(new URLSearchParams("?level=3,abc,5"));
    expect(filters.levels).toEqual([3, 5]);
  });

  it("defaults sort to name for anything unrecognised", () => {
    expect(filtersFromSearch(new URLSearchParams("?sort=nonsense")).sort).toBe(
      "name",
    );
  });
});

describe("toggle", () => {
  it("adds and removes", () => {
    expect(toggle([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggle([1, 2], 2)).toEqual([1]);
  });
});
