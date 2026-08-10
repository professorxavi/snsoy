import {
  ClearFilters,
  CollapsedFilterRail,
  FilterGroup,
  FilterOption,
  FilterRailBody,
} from "@/components/compendium/filter-rail";
import { abilityName } from "@/lib/content/dnd";
import { toggleFlag, toggleValue, type QueryParams } from "@/lib/query-params";
import type { FeatFacetOptions } from "@/server/db/queries/feats";

/**
 * The feat rail. Two facets, both of them a question asked at a table rather
 * than a property of the data.
 *
 * "Raises" is the ability a feat can increase — half the feats grant one, and a
 * character with an odd score is shopping for exactly that. "Anyone can take"
 * is the absence of a prerequisite; the rest of a prerequisite is prose, and no
 * facet could carry "elf or half-elf, 4th level" without flattening the
 * alternatives into a lie.
 */

export const FILTER_KEYS = ["q", "ability", "open"];

const BASE = "/compendium/feats";

export function FeatFilters({
  params,
  facets,
}: {
  params: QueryParams;
  facets: FeatFacetOptions;
}) {
  return (
    <FilterRailBody>
      <ClearFilters params={params} filterKeys={FILTER_KEYS} basePath={BASE} />

      <FilterGroup label="Raises">
        {facets.abilities.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "ability", facet.value)}`}
          >
            {abilityName(facet.value)}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Requires">
        <FilterOption
          facet={facets.open}
          href={`${BASE}${toggleFlag(params, "open")}`}
        >
          Nothing at all
        </FilterOption>
      </FilterGroup>
    </FilterRailBody>
  );
}

export function CollapsedFilters({ params }: { params: QueryParams }) {
  return <CollapsedFilterRail params={params} filterKeys={FILTER_KEYS} />;
}
