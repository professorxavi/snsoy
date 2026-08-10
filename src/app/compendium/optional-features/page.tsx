import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import {
  CollapsedFilters,
  FILTER_KEYS,
  OptionalFeatureFilters,
} from "@/components/compendium/optional-feature-filters";
import { BrowseColumns, FilterRail } from "@/components/layout";
import {
  featureTypeSummary,
  formatPrerequisites,
} from "@/lib/content/optional-features";
import {
  hasFilters,
  readList,
  readString,
  type QueryParams,
} from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import {
  listOptionalFeatures,
  optionalFeatureFacets,
  type OptionalFeatureListRow,
} from "@/server/db/queries/optional-features";

export const metadata: Metadata = {
  title: "Optional Features",
  description:
    "Eldritch invocations, manoeuvres, metamagic, infusions and every other choice a class feature offers.",
};

const COLUMNS: GenericColumn<OptionalFeatureListRow>[] = [
  { label: "Kind", cell: (row) => featureTypeSummary(row.featureTypes) },
  {
    label: "Prerequisite",
    cell: (row) => formatPrerequisites(row.prerequisites) ?? "—",
    optional: true,
  },
];

const BASE = listHrefFor("optionalfeature");

/**
 * The optional features browse view.
 *
 * These already render inside a class page, under the feature that offers them
 * — a warlock reads its 54 invocations there, in the place the choice is made.
 * This list is the other direction: the whole set at once, which is what
 * someone comparing invocations across levels, or looking for the one they half
 * remember, actually wants.
 */
export default async function OptionalFeaturesPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const filters = {
    kinds: readList(params, "kind"),
    q: readString(params, "q"),
  };

  const [rows, facets] = await Promise.all([
    listOptionalFeatures(filters),
    optionalFeatureFacets(filters),
  ]);

  const filtered = hasFilters(params, FILTER_KEYS);

  return (
    <BrowseColumns>
      <FilterRail collapsed={<CollapsedFilters params={params} />}>
        <OptionalFeatureFilters params={params} facets={facets} />
      </FilterRail>

      <main id="main">
        <ListToolbar
          params={params}
          matched={rows.length}
          filtered={filtered}
          basePath={BASE}
          noun={["option", "options"]}
          carriedKeys={FILTER_KEYS}
        />

        <GenericTable
          rows={rows}
          type="optionalfeature"
          columns={COLUMNS}
          noun="options"
          filtered={filtered}
          open={openEntityAside.bind(null, "optionalfeature")}
        />
      </main>
    </BrowseColumns>
  );
}
