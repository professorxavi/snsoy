import {
  ClearFilters,
  CollapsedFilterRail,
  FilterGroup,
  FilterOption,
  FilterRailBody,
} from "@/components/compendium/filter-rail";
import { levelLabel, schoolName } from "@/lib/content/spells";
import { toggleFlag, toggleValue, type QueryParams } from "@/lib/query-params";
import type { SpellFacetOptions } from "@/server/db/queries/spells";

/**
 * The spell filter rail — which facets a spell has, and what to call their
 * values. How an option behaves is `filter-rail`'s business and shared with
 * every other rail.
 *
 * Every option is always shown; one that would return nothing is disabled
 * rather than removed, so the rail never rearranges as you filter. Counts come
 * from a facet query that counts each facet against the *other* filters, so
 * selecting "Evocation" does not zero out every other school.
 */

const CASTING_TIME_LABELS: Record<string, string> = {
  action: "Action",
  bonus: "Bonus action",
  reaction: "Reaction",
  round: "Round",
  minute: "Minute",
  hour: "Hour",
};

/** Parameters that count as filters — `page` and `sort` are not. */
export const FILTER_KEYS = [
  "q",
  "level",
  "school",
  "time",
  "class",
  "conc",
  "ritual",
];

const BASE = "/compendium/spells";

export function SpellFilters({
  params,
  facets,
}: {
  params: QueryParams;
  facets: SpellFacetOptions;
}) {
  return (
    <FilterRailBody>
      <ClearFilters params={params} filterKeys={FILTER_KEYS} basePath={BASE} />

      <FilterGroup label="Level">
        {facets.levels.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "level", String(facet.value))}`}
          >
            {levelLabel(facet.value)}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="School">
        {facets.schools.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "school", facet.value)}`}
          >
            {schoolName(facet.value)}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Casting time">
        {facets.castingTimes.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "time", facet.value)}`}
          >
            {CASTING_TIME_LABELS[facet.value] ?? facet.value}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Class">
        {facets.classes.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "class", facet.value)}`}
          >
            {facet.value}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Requires">
        <FilterOption
          facet={facets.concentration}
          href={`${BASE}${toggleFlag(params, "conc")}`}
        >
          Concentration
        </FilterOption>
        <FilterOption
          facet={facets.ritual}
          href={`${BASE}${toggleFlag(params, "ritual")}`}
        >
          Ritual
        </FilterOption>
      </FilterGroup>
    </FilterRailBody>
  );
}

/** The collapsed rail shown once the aside takes the width. */
export function CollapsedFilters({ params }: { params: QueryParams }) {
  return <CollapsedFilterRail params={params} filterKeys={FILTER_KEYS} />;
}
