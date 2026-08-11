import {
  ClearFilters,
  CollapsedFilterRail,
  FilterGroup,
  FilterOption,
  FilterRailBody,
} from "@/components/compendium/filter-rail";
import { toggleValue, type QueryParams } from "@/lib/query-params";
import type { DeityFacetOptions } from "@/server/db/queries/deities";

/**
 * The deity rail: whose god, what alignment, which domains.
 *
 * Pantheon is the one that makes the list usable — 494 gods across 23 of them,
 * and a reader looking for Bane means the Faerûnian one or the Dragonlance one.
 * Domain is the question from the other direction: a cleric picks a god by what
 * it lets them prepare.
 */

export const FILTER_KEYS = ["q", "pantheon", "domain", "alignment"];

const BASE = "/compendium/deities";

export function DeityFilters({
  params,
  facets,
}: {
  params: QueryParams;
  facets: DeityFacetOptions;
}) {
  return (
    <FilterRailBody>
      <ClearFilters params={params} filterKeys={FILTER_KEYS} basePath={BASE} />

      <FilterGroup label="Pantheon">
        {facets.pantheons.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "pantheon", facet.value)}`}
          >
            {facet.value}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Domain">
        {facets.domains.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "domain", facet.value)}`}
          >
            {facet.value}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Alignment">
        {facets.alignments.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "alignment", facet.value)}`}
          >
            {/* The codes stay in the URL; the rail spells them out. */}
            {facet.label ?? facet.value}
          </FilterOption>
        ))}
      </FilterGroup>
    </FilterRailBody>
  );
}

export function CollapsedFilters({ params }: { params: QueryParams }) {
  return <CollapsedFilterRail params={params} filterKeys={FILTER_KEYS} />;
}
