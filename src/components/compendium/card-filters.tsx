import {
  ClearFilters,
  CollapsedFilterRail,
  FilterGroup,
  FilterOption,
  FilterRailBody,
} from "@/components/compendium/filter-rail";
import { toggleValue, type QueryParams } from "@/lib/query-params";
import type { CardFacetOptions } from "@/server/db/queries/cards";

/**
 * The card rail: one facet, and it is the whole list.
 *
 * 656 cards across 23 decks, and nobody browses cards in general — they browse
 * a deck. Without this the list is 656 unrelated rows, most of which belong to
 * a boxed set the reader has never heard of.
 */

export const FILTER_KEYS = ["q", "deck"];

const BASE = "/compendium/cards";

export function CardFilters({
  params,
  facets,
}: {
  params: QueryParams;
  facets: CardFacetOptions;
}) {
  return (
    <FilterRailBody>
      <ClearFilters params={params} filterKeys={FILTER_KEYS} basePath={BASE} />

      <FilterGroup label="Deck">
        {facets.decks.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "deck", facet.value)}`}
          >
            {facet.value}
          </FilterOption>
        ))}
      </FilterGroup>
    </FilterRailBody>
  );
}

export function CollapsedFilters({ params }: { params: QueryParams }) {
  return <CollapsedFilterRail params={params} filterKeys={FILTER_KEYS} />;
}
