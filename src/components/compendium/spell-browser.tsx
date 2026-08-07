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
  pageCountFor,
  pageOf,
  sortSpells,
  toggle,
  type SpellFilterState,
  type SpellSort,
} from "@/lib/content/spell-browse";
import type { SpellRow } from "@/server/db/queries/spells";
import { ListToolbar, Pager } from "./list-chrome";
import { CollapsedFilters, SpellFilters } from "./spell-filters";
import { SpellTable } from "./spell-table";

/**
 * The spell browse view.
 *
 * Holds the whole spell list and does all filtering, searching, sorting, paging
 * and facet counting in memory. That is only reasonable because there are 525
 * spells — see the note on `allSpells` — but where it is reasonable it is much
 * better: typing in the search box updates the table on the keystroke, with no
 * request in between.
 *
 * Paging is presentational and nothing more. Every row is already here; a page
 * is a slice, chosen so the table reads as a page of results rather than a
 * 525-row scroll. Nothing is fetched when it changes.
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
  initialPage,
}: {
  spells: SpellRow[];
  /** Parsed from the URL on the server, so the first paint is already filtered. */
  initialFilters: SpellFilterState;
  initialPage: number;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(initialPage);

  // Back and forward move through filter and page states, so the URL has to be
  // able to drive the state as well — but only when the browser says so.
  useEffect(() => {
    const onPopState = () => {
      const search = new URLSearchParams(window.location.search);
      setFilters(filtersFromSearch(search));
      const raw = Number(search.get("page"));
      setPage(Number.isInteger(raw) && raw > 0 ? raw : 1);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const write = useCallback(
    (next: SpellFilterState, nextPage: number, replace = false) => {
      setFilters(next);
      setPage(nextPage);

      const url = `/compendium/spells${filtersToQuery(next, nextPage)}`;
      // Typing replaces rather than pushes: every keystroke would otherwise be
      // a history entry, and Back would walk backwards through the word.
      if (replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    },
    [],
  );

  /**
   * Any change to what is being shown returns to page one.
   *
   * Page 7 of an unfiltered list is not page 7 of a filtered one, and landing
   * on an empty page after narrowing is the most confusing thing a paged list
   * can do.
   */
  const update = useCallback(
    (next: SpellFilterState, options: { replace?: boolean } = {}) =>
      write(next, 1, options.replace),
    [write],
  );

  const visible = useMemo(
    () => sortSpells(filterSpells(spells, filters), filters.sort),
    [spells, filters],
  );

  const facets = useMemo(() => facetOptions(spells, filters), [spells, filters]);

  const pageCount = pageCountFor(visible.length);
  // Clamped rather than trusted: a hand-edited `?page=99` should show the last
  // page, not an empty table.
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const rows = useMemo(
    () => pageOf(visible, currentPage),
    [visible, currentPage],
  );

  const filtered = hasActiveFilters(filters);

  const goToPage = useCallback(
    (next: number) => {
      write(filters, Math.min(Math.max(1, next), pageCount));
      // A new page starts at its top; otherwise Next leaves you mid-table
      // looking at rows you have not seen the header for.
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [filters, pageCount, write],
  );

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
          onToggleRitual={() => update({ ...filters, ritual: !filters.ritual })}
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
          rows={rows}
          sort={filters.sort}
          onSort={(sort: SpellSort) => update({ ...filters, sort })}
        />
        <Pager page={currentPage} pageCount={pageCount} onPage={goToPage} />
      </Box>
    </BrowseColumns>
  );
}
