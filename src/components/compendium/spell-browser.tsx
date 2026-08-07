"use client";

import { Box } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowseColumns, FilterRail } from "@/components/layout";
import {
  EMPTY_FILTERS,
  facetOptions,
  filterSpells,
  filtersFromSearch,
  filtersToQuery,
  hasActiveFilters,
  sortSpells,
  toggle,
  type SpellFilterState,
  type SpellSort,
} from "@/lib/content/spell-browse";
import type { SpellRow } from "@/server/db/queries/spells";
import { ListToolbar } from "./list-chrome";
import { CollapsedFilters, SpellFilters } from "./spell-filters";
import { SpellTable } from "./spell-table";

/**
 * The spell browse view.
 *
 * Holds the whole spell list and does all filtering, searching, sorting and
 * facet counting in memory. That is only reasonable because there are 525
 * spells — see the note on `allSpells` — but where it is reasonable it is much
 * better: typing in the search box updates the table on the keystroke, with no
 * request in between.
 *
 * Filter state is still written to the URL, so a filtered list stays linkable
 * and the back button still works. It is written with the **native History
 * API** rather than `router.push`, because a Next navigation would re-run the
 * server component and re-fetch the list we already hold — turning an instant
 * interaction back into a round trip. The URL and the state stay in step
 * without the URL driving the render.
 */
export function SpellBrowser({
  spells,
  initialFilters,
}: {
  spells: SpellRow[];
  /** Parsed from the URL on the server, so the first paint is already filtered. */
  initialFilters: SpellFilterState;
}) {
  const [filters, setFilters] = useState(initialFilters);

  // Back and forward move through filter states, so the URL has to be able to
  // drive the state as well — but only when the browser says so.
  useEffect(() => {
    const onPopState = () => {
      setFilters(filtersFromSearch(new URLSearchParams(window.location.search)));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const update = useCallback(
    (next: SpellFilterState, options: { replace?: boolean } = {}) => {
      setFilters(next);

      const url = `/compendium/spells${filtersToQuery(next)}`;
      // Typing replaces rather than pushes: every keystroke would otherwise be
      // a history entry, and Back would walk backwards through the word.
      if (options.replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    },
    [],
  );

  const visible = useMemo(() => {
    return sortSpells(filterSpells(spells, filters), filters.sort);
  }, [spells, filters]);

  const facets = useMemo(
    () => facetOptions(spells, filters),
    [spells, filters],
  );

  const filtered = hasActiveFilters(filters);

  return (
    <BrowseColumns>
      <FilterRail collapsed={<CollapsedFilters active={filtered} />}>
        <SpellFilters
          facets={facets}
          filtered={filtered}
          onToggleLevel={(value) =>
            update({ ...filters, levels: toggle(filters.levels, value) })
          }
          onToggleSchool={(value) =>
            update({ ...filters, schools: toggle(filters.schools, value) })
          }
          onToggleTime={(value) =>
            update({ ...filters, times: toggle(filters.times, value) })
          }
          onToggleClass={(value) =>
            update({ ...filters, classes: toggle(filters.classes, value) })
          }
          onToggleConcentration={() =>
            update({ ...filters, concentration: !filters.concentration })
          }
          onToggleRitual={() =>
            update({ ...filters, ritual: !filters.ritual })
          }
          onClear={() => update({ ...EMPTY_FILTERS, sort: filters.sort })}
        />
      </FilterRail>

      <Box as="main" id="main" minW="0">
        <ListToolbar
          query={filters.q}
          onQueryChange={(q) => update({ ...filters, q }, { replace: true })}
          matched={visible.length}
          filtered={filtered}
        />
        <SpellTable
          rows={visible}
          sort={filters.sort}
          onSort={(sort: SpellSort) => update({ ...filters, sort })}
        />
      </Box>
    </BrowseColumns>
  );
}
