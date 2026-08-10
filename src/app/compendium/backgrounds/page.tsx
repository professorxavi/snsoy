import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  BackgroundFilters,
  CollapsedFilters,
  FILTER_KEYS,
} from "@/components/compendium/background-filters";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import { BrowseColumns, FilterRail } from "@/components/layout";
import {
  languageSummary,
  proficiencySummary,
} from "@/lib/content/backgrounds";
import {
  hasFilters,
  readList,
  readString,
  type QueryParams,
} from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import {
  backgroundFacets,
  listBackgrounds,
  type BackgroundRow,
} from "@/server/db/queries/backgrounds";

export const metadata: Metadata = {
  title: "Backgrounds",
  description:
    "Every background, filtered by the skills it grants, with its feature and proficiencies.",
};

/**
 * Skills first, because they are what the rail filters and what a reader is
 * comparing between two rows. The feature is the background's own name for what
 * it gives you beyond proficiencies, and it is the reason two backgrounds
 * granting the same pair are not the same background.
 */
const COLUMNS: GenericColumn<BackgroundRow>[] = [
  { label: "Skills", cell: (row) => proficiencySummary(row.skills) },
  { label: "Tools", cell: (row) => proficiencySummary(row.tools), optional: true },
  {
    label: "Languages",
    cell: (row) => languageSummary(row.languageCount),
    optional: true,
    nowrap: true,
  },
  { label: "Feature", cell: (row) => row.featureName ?? "—" },
];

const BASE = listHrefFor("background");

/**
 * The backgrounds browse view.
 *
 * 96 rows and no pager: the whole list is one query, and a page break through
 * a set this size would hide half of it for no gain. Unlike the rules lists,
 * this one earns a rail — a background is picked for its skills, and scanning
 * 96 rows for Stealth is the work the facet removes.
 */
export default async function BackgroundsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const filters = {
    skills: readList(params, "skill"),
    q: readString(params, "q"),
  };

  // Facet counts are computed against the same filters, so the two overlap.
  const [rows, facets] = await Promise.all([
    listBackgrounds(filters),
    backgroundFacets(filters),
  ]);

  const filtered = hasFilters(params, FILTER_KEYS);

  return (
    <BrowseColumns>
      <FilterRail collapsed={<CollapsedFilters params={params} />}>
        <BackgroundFilters params={params} facets={facets} />
      </FilterRail>

      <main id="main">
        <ListToolbar
          params={params}
          matched={rows.length}
          filtered={filtered}
          basePath={BASE}
          noun={["background", "backgrounds"]}
          carriedKeys={FILTER_KEYS}
        />

        <GenericTable
          rows={rows}
          type="background"
          columns={COLUMNS}
          noun="backgrounds"
          filtered={filtered}
          open={openEntityAside.bind(null, "background")}
        />
      </main>
    </BrowseColumns>
  );
}
