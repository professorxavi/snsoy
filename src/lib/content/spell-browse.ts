/**
 * Filtering, sorting and faceting for the spell browse view.
 *
 * All of it runs on the client, over the whole spell list, which is what makes
 * search and filtering instant. Kept here — pure, React-free, no database — so
 * the rules can be tested directly rather than through a rendered table.
 *
 * The important behaviour is in `facetOptions`: **every option is always
 * offered**, and one that would return nothing is disabled rather than removed.
 * A rail whose contents move as you filter is a rail you cannot learn, and
 * disappearing options hide the shape of the data — you can never see that
 * there simply are no 9th-level abjuration cantrips, only that the row is gone.
 */

/** The fields the browse view filters on. */
export interface BrowsableSpell {
  name: string;
  level: number;
  school: string;
  castingTimeUnit: string;
  isConcentration: boolean;
  isRitual: boolean;
  classes: string[] | null;
}

export type SpellSort = "name" | "level";

export interface SpellFilterState {
  levels: number[];
  schools: string[];
  times: string[];
  classes: string[];
  concentration: boolean;
  ritual: boolean;
  q: string;
  sort: SpellSort;
}

export const EMPTY_FILTERS: SpellFilterState = {
  levels: [],
  schools: [],
  times: [],
  classes: [],
  concentration: false,
  ritual: false,
  q: "",
  sort: "name",
};

/** Which filters are set. Sort and search order are not filters. */
export function activeFilterCount(filters: SpellFilterState): number {
  return (
    filters.levels.length +
    filters.schools.length +
    filters.times.length +
    filters.classes.length +
    (filters.concentration ? 1 : 0) +
    (filters.ritual ? 1 : 0) +
    (filters.q.trim() ? 1 : 0)
  );
}

export function hasActiveFilters(filters: SpellFilterState): boolean {
  return activeFilterCount(filters) > 0;
}

/* ------------------------------------------------------------------ *
 * URL mapping
 * ------------------------------------------------------------------ */

/**
 * Filter state still lives in the URL, even though it is now held in client
 * state and applied without a round trip.
 *
 * Both directions matter: the server reads the URL so its first render is
 * already filtered — no flash of 525 unfiltered rows — and the client writes
 * back so "2nd-level concentration spells a bard can cast" stays a link
 * someone can paste into chat mid-session.
 */
export function filtersFromSearch(search: URLSearchParams): SpellFilterState {
  const list = (key: string) =>
    (search.get(key) ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

  return {
    levels: list("level")
      .map(Number)
      .filter((value) => Number.isInteger(value)),
    schools: list("school"),
    times: list("time"),
    classes: list("class"),
    concentration: search.get("conc") === "1",
    ritual: search.get("ritual") === "1",
    q: search.get("q")?.trim() ?? "",
    sort: search.get("sort") === "level" ? "level" : "name",
  };
}

/**
 * Serialise back to a query string.
 *
 * Defaults are omitted and keys are sorted, so one filter state has exactly one
 * URL — otherwise the same view would produce different links depending on the
 * order the reader happened to click things.
 */
export function filtersToQuery(filters: SpellFilterState): string {
  const search = new URLSearchParams();

  if (filters.levels.length) search.set("level", filters.levels.join(","));
  if (filters.schools.length) search.set("school", filters.schools.join(","));
  if (filters.times.length) search.set("time", filters.times.join(","));
  if (filters.classes.length) search.set("class", filters.classes.join(","));
  if (filters.concentration) search.set("conc", "1");
  if (filters.ritual) search.set("ritual", "1");
  if (filters.q.trim()) search.set("q", filters.q.trim());
  if (filters.sort !== "name") search.set("sort", filters.sort);

  search.sort();
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Add or remove one value from a multi-value filter. */
export function toggle<T>(current: T[], value: T): T[] {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

/**
 * Which filter groups to apply.
 *
 * Facet counting needs to evaluate every filter *except* the one being counted,
 * so matching takes a set of groups to skip rather than a pre-edited copy of
 * the state.
 */
export type FilterGroup =
  | "levels"
  | "schools"
  | "times"
  | "classes"
  | "flags"
  | "q";

export function matchesSpell(
  spell: BrowsableSpell,
  filters: SpellFilterState,
  skip?: FilterGroup,
): boolean {
  if (
    skip !== "levels" &&
    filters.levels.length > 0 &&
    !filters.levels.includes(spell.level)
  ) {
    return false;
  }

  if (
    skip !== "schools" &&
    filters.schools.length > 0 &&
    !filters.schools.includes(spell.school)
  ) {
    return false;
  }

  if (
    skip !== "times" &&
    filters.times.length > 0 &&
    !filters.times.includes(spell.castingTimeUnit)
  ) {
    return false;
  }

  // A spell matches if *any* selected class can cast it, not all of them.
  if (skip !== "classes" && filters.classes.length > 0) {
    const casters = spell.classes ?? [];
    if (!filters.classes.some((name) => casters.includes(name))) return false;
  }

  if (skip !== "flags") {
    if (filters.concentration && !spell.isConcentration) return false;
    if (filters.ritual && !spell.isRitual) return false;
  }

  if (skip !== "q") {
    const query = filters.q.trim().toLowerCase();
    if (query && !spell.name.toLowerCase().includes(query)) return false;
  }

  return true;
}

export function filterSpells<T extends BrowsableSpell>(
  spells: readonly T[],
  filters: SpellFilterState,
): T[] {
  return spells.filter((spell) => matchesSpell(spell, filters));
}

/**
 * Sorting.
 *
 * Level ties break by name, because a level column full of 3s in arbitrary
 * order is not sorted in any sense a reader can use.
 */
export function sortSpells<T extends BrowsableSpell>(
  spells: readonly T[],
  sort: SpellSort,
): T[] {
  const sorted = [...spells];

  sorted.sort((a, b) =>
    sort === "level" && a.level !== b.level
      ? a.level - b.level
      : a.name.localeCompare(b.name),
  );

  return sorted;
}

/* ------------------------------------------------------------------ *
 * Facets
 * ------------------------------------------------------------------ */

export interface FacetOption<T> {
  value: T;
  /** How many spells this option would leave, given the *other* filters. */
  count: number;
  selected: boolean;
  /** Nothing to show. Kept visible and inert rather than removed. */
  disabled: boolean;
}

export interface SpellFacets {
  levels: FacetOption<number>[];
  schools: FacetOption<string>[];
  times: FacetOption<string>[];
  classes: FacetOption<string>[];
  concentration: FacetOption<"conc">;
  ritual: FacetOption<"ritual">;
}

function tally<T>(
  spells: readonly BrowsableSpell[],
  filters: SpellFilterState,
  group: FilterGroup,
  valuesOf: (spell: BrowsableSpell) => T[],
): Map<T, number> {
  const counts = new Map<T, number>();

  for (const spell of spells) {
    // Counted against every other filter but not its own, so selecting
    // "Evocation" does not zero out every other school in the list.
    if (!matchesSpell(spell, filters, group)) continue;
    for (const value of valuesOf(spell)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * Build the option list for every facet.
 *
 * The **domain** — which options exist at all — comes from the full spell list
 * and never changes as filters are applied. Only the counts and the disabled
 * flag move.
 */
export function facetOptions(
  all: readonly BrowsableSpell[],
  filters: SpellFilterState,
): SpellFacets {
  const options = <T>(
    domain: T[],
    group: FilterGroup,
    valuesOf: (spell: BrowsableSpell) => T[],
    selected: readonly T[],
  ): FacetOption<T>[] => {
    const counts = tally(all, filters, group, valuesOf);
    return domain.map((value) => {
      const count = counts.get(value) ?? 0;
      const isSelected = selected.includes(value);
      return {
        value,
        count,
        selected: isSelected,
        // A selected option stays clickable even at zero, or a filter that
        // narrows to nothing could never be undone from the rail.
        disabled: count === 0 && !isSelected,
      };
    });
  };

  const flag = <T extends string>(
    value: T,
    predicate: (spell: BrowsableSpell) => boolean,
    selected: boolean,
  ): FacetOption<T> => {
    let count = 0;
    for (const spell of all) {
      if (matchesSpell(spell, filters, "flags") && predicate(spell)) count++;
    }
    return { value, count, selected, disabled: count === 0 && !selected };
  };

  return {
    levels: options(
      domainOf(all, (s) => [s.level]).sort((a, b) => a - b),
      "levels",
      (s) => [s.level],
      filters.levels,
    ),
    schools: options(
      domainOf(all, (s) => [s.school]).sort(),
      "schools",
      (s) => [s.school],
      filters.schools,
    ),
    times: options(
      orderTimes(domainOf(all, (s) => [s.castingTimeUnit])),
      "times",
      (s) => [s.castingTimeUnit],
      filters.times,
    ),
    classes: options(
      domainOf(all, (s) => s.classes ?? []).sort(),
      "classes",
      (s) => s.classes ?? [],
      filters.classes,
    ),
    concentration: flag("conc", (s) => s.isConcentration, filters.concentration),
    ritual: flag("ritual", (s) => s.isRitual, filters.ritual),
  };
}

/** Every value that occurs anywhere in the corpus, regardless of filters. */
function domainOf<T>(
  spells: readonly BrowsableSpell[],
  valuesOf: (spell: BrowsableSpell) => T[],
): T[] {
  const seen = new Set<T>();
  for (const spell of spells) {
    for (const value of valuesOf(spell)) seen.add(value);
  }
  return [...seen];
}

/** Action economy order, not alphabetical — "action" before "bonus". */
const TIME_ORDER = ["action", "bonus", "reaction", "round", "minute", "hour"];

function orderTimes(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const ai = TIME_ORDER.indexOf(a);
    const bi = TIME_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
