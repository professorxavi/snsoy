import {
  ClearFilters,
  CollapsedFilterRail,
  FilterGroup,
  FilterOption,
  FilterRailBody,
} from "@/components/compendium/filter-rail";
import { rarityLabel } from "@/lib/content/items";
import { toggleFlag, toggleValue, type QueryParams } from "@/lib/query-params";
import type { ItemFacetOptions } from "@/server/db/queries/items";

/**
 * The item filter rail.
 *
 * Rarity leads, because it is the question someone arrives with — what is
 * appropriate to hand this party — and the rest narrows what rarity has already
 * answered.
 *
 * Category comes second, and is the coarsest cut the list makes: treasure
 * against shopping. It is not the magic question, which `isMagic` answers and
 * which has its own control below — 567 of the 3,448 `item` rows are non-magic.
 * Item groups used to be a third option here and are no longer browsed at all;
 * see `BROWSED_ITEM_TYPES`.
 *
 * All 36 types are listed rather than banded into "weapons" and "armour". A
 * band is a judgement the data does not make, and someone looking for a
 * spellcasting focus wants exactly that. The rail scrolls; that is cheaper than
 * being wrong about the bands.
 */

/** Parameters that count as filters — `page` and `sort` are not. */
export const FILTER_KEYS = [
  "q",
  "rarity",
  "type",
  "category",
  "attunement",
  "magic",
];

const BASE = "/compendium/items";

export function ItemFilters({
  params,
  facets,
}: {
  params: QueryParams;
  facets: ItemFacetOptions;
}) {
  return (
    <FilterRailBody>
      <ClearFilters params={params} filterKeys={FILTER_KEYS} basePath={BASE} />

      <FilterGroup label="Rarity">
        {facets.rarities.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "rarity", facet.value)}`}
          >
            {rarityLabel(facet.value)}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Category">
        {facets.categories.map((facet) => (
          <FilterOption
            key={facet.value}
            facet={facet}
            href={`${BASE}${toggleValue(params, "category", facet.value)}`}
          >
            {facet.label}
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
            {/* Stored as an abbreviation; nobody browses by "SCF". */}
            {facet.label}
          </FilterOption>
        ))}
      </FilterGroup>

      <FilterGroup label="Has">
        <FilterOption
          facet={facets.attunement}
          href={`${BASE}${toggleFlag(params, "attunement")}`}
        >
          Attunement
        </FilterOption>
        <FilterOption
          facet={facets.magic}
          href={`${BASE}${toggleFlag(params, "magic")}`}
        >
          Magic
        </FilterOption>
      </FilterGroup>
    </FilterRailBody>
  );
}

/** The collapsed rail shown once the aside takes the width. */
export function CollapsedFilters({ params }: { params: QueryParams }) {
  return <CollapsedFilterRail params={params} filterKeys={FILTER_KEYS} />;
}
