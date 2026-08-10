import {
  ClearFilters,
  CollapsedFilterRail,
  FilterGroup,
  FilterOption,
  FilterRailBody,
} from "@/components/compendium/filter-rail";
import { toggleValue, type QueryParams } from "@/lib/query-params";
import type { OptionalFeatureFacetOptions } from "@/server/db/queries/optional-features";

/**
 * The optional feature rail: which kind of choice this is.
 *
 * Without it the list is 151 rows of unrelated things — an eldritch invocation
 * beside a battle master manoeuvre beside an artificer infusion — and no reader
 * ever wants all of them at once. They want the 54 their warlock can take.
 */

export const FILTER_KEYS = ["q", "kind"];

const BASE = "/compendium/optional-features";

export function OptionalFeatureFilters({
  params,
  facets,
}: {
  params: QueryParams;
  facets: OptionalFeatureFacetOptions;
}) {
  return (
    <FilterRailBody>
      <ClearFilters params={params} filterKeys={FILTER_KEYS} basePath={BASE} />

      <FilterGroup label="Kind">
        {facets.kinds.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "kind", facet.value)}`}
          >
            {/* The code stays in the URL; the rail shows what it means. */}
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
