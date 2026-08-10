import {
  ClearFilters,
  CollapsedFilterRail,
  FilterGroup,
  FilterOption,
  FilterRailBody,
} from "@/components/compendium/filter-rail";
import { formatSize } from "@/lib/content/monsters";
import { toggleFlag, toggleValue, type QueryParams } from "@/lib/query-params";
import type { MonsterFacetOptions } from "@/server/db/queries/monsters";

/**
 * The creature filter rail.
 *
 * Challenge rating leads, because it is the question a DM actually arrives
 * with — what can this party survive — and everything else narrows what CR has
 * already answered.
 *
 * All 35 ratings are listed rather than banded into "1–4", "5–10". A band is a
 * judgement about which ratings belong together, the data does not make one,
 * and a reader building an encounter for a specific party wants a specific
 * number. The rail scrolls; that is cheaper than being wrong about the bands.
 */

/** Parameters that count as filters — `page` and `sort` are not. */
export const FILTER_KEYS = [
  "q",
  "cr",
  "type",
  "size",
  "env",
  "legendary",
  "caster",
];

const BASE = "/compendium/monsters";

/** Environments are stored lowercase and printed as words. */
const capitalise = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

export function MonsterFilters({
  params,
  facets,
}: {
  params: QueryParams;
  facets: MonsterFacetOptions;
}) {
  return (
    <FilterRailBody>
      <ClearFilters params={params} filterKeys={FILTER_KEYS} basePath={BASE} />

      <FilterGroup label="Challenge">
        {facets.crs.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "cr", facet.value)}`}
          >
            {facet.value}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Type">
        {facets.types.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "type", facet.value)}`}
          >
            {capitalise(facet.value)}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Size">
        {facets.sizes.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "size", facet.value)}`}
          >
            {/* Stored as a single letter; nobody browses by "G". */}
            {formatSize([facet.value])}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Environment">
        {facets.environments.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "env", facet.value)}`}
          >
            {capitalise(facet.value)}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Has">
        <FilterOption
          facet={facets.legendary}
          href={`${BASE}${toggleFlag(params, "legendary")}`}
        >
          Legendary actions
        </FilterOption>
        <FilterOption
          facet={facets.spellcaster}
          href={`${BASE}${toggleFlag(params, "caster")}`}
        >
          Spellcasting
        </FilterOption>
      </FilterGroup>
    </FilterRailBody>
  );
}

/** The collapsed rail shown once the aside takes the width. */
export function CollapsedFilters({ params }: { params: QueryParams }) {
  return <CollapsedFilterRail params={params} filterKeys={FILTER_KEYS} />;
}
