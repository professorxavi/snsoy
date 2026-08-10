import {
  ClearFilters,
  CollapsedFilterRail,
  FilterGroup,
  FilterOption,
  FilterRailBody,
} from "@/components/compendium/filter-rail";
import { proficiencyLabel } from "@/lib/content/backgrounds";
import { toggleValue, type QueryParams } from "@/lib/query-params";
import type { BackgroundFacetOptions } from "@/server/db/queries/backgrounds";

/**
 * The background rail: one facet, and it is the one the list exists to answer.
 *
 * A background is chosen for what it makes your character good at, so the
 * skills are the whole question — 18 of them across 96 backgrounds. There is
 * nothing else here worth filtering: a tool facet would be 40 options for 70
 * backgrounds, most of them appearing once.
 */

export const FILTER_KEYS = ["q", "skill"];

const BASE = "/compendium/backgrounds";

export function BackgroundFilters({
  params,
  facets,
}: {
  params: QueryParams;
  facets: BackgroundFacetOptions;
}) {
  return (
    <FilterRailBody>
      <ClearFilters params={params} filterKeys={FILTER_KEYS} basePath={BASE} />

      <FilterGroup label="Skill">
        {facets.skills.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "skill", facet.value)}`}
          >
            {proficiencyLabel(facet.value)}
          </FilterOption>
        ))}
      </FilterGroup>
    </FilterRailBody>
  );
}

export function CollapsedFilters({ params }: { params: QueryParams }) {
  return <CollapsedFilterRail params={params} filterKeys={FILTER_KEYS} />;
}
