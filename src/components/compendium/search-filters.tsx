import {
  ClearFilters,
  CollapsedFilterRail,
  FilterGroup,
  FilterOption,
  FilterRailBody,
} from "@/components/compendium/filter-rail";
import { typeLabel } from "@/lib/content/search";
import { toggleValue, type QueryParams } from "@/lib/query-params";
import type { SearchFacetOptions } from "@/server/db/queries/search";

/**
 * The search filter rail: one facet, and it is the kind of thing a result is.
 *
 * That single distinction is what a mixed result list actually needs. Searching
 * "grappled" reaches one condition and two cards that reprint it on cardboard;
 * "fireball" reaches a spell, four items, a chapter and a recipe. Type is what
 * separates them.
 *
 * There is deliberately no source facet. It would list around 120 books, which
 * is a picture of the corpus rather than a way to find a spell — and a reader
 * who knows which book a thing is in did not need to search for it.
 */

/** Parameters that count as filters. `q` is the query, not a filter. */
export const FILTER_KEYS = ["type"];

const BASE = "/search";

export function SearchFilters({
  params,
  facets,
}: {
  params: QueryParams;
  facets: SearchFacetOptions;
}) {
  return (
    <FilterRailBody>
      {/* `q` survives: clearing the type filter is not a request to abandon
          the search that produced these results. */}
      <ClearFilters
        params={params}
        filterKeys={FILTER_KEYS}
        basePath={BASE}
        keep={["q"]}
      />

      <FilterGroup label="Kind">
        {facets.types.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "type", facet.value)}`}
          >
            {typeLabel(facet.value)}
          </FilterOption>
        ))}
      </FilterGroup>
    </FilterRailBody>
  );
}

/** The collapsed rail shown once the aside takes the width. */
export function CollapsedFilters({ params }: { params: QueryParams }) {
  return <CollapsedFilterRail params={params} filterKeys={FILTER_KEYS} />;
}
