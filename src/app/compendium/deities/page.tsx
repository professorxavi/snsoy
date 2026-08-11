import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  CollapsedFilters,
  DeityFilters,
  FILTER_KEYS,
} from "@/components/compendium/deity-filters";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar, Pager } from "@/components/compendium/list-controls";
import { BrowseColumns, FilterRail } from "@/components/layout";
import { alignmentLabel, deityDomains } from "@/lib/content/deities";
import {
  hasFilters,
  readList,
  readPage,
  readString,
  type QueryParams,
} from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import {
  deityFacets,
  listDeities,
  type DeityRow,
} from "@/server/db/queries/deities";

export const metadata: Metadata = {
  title: "Deities",
  description:
    "Every god in every pantheon, filtered by pantheon, domain and alignment.",
};

/**
 * The pantheon comes first and never sheds: it is what tells three gods called
 * Bane apart, so a reader who loses it cannot use the list at all. The title is
 * the books' own phrasing for what a god is god of, which is the next thing
 * anyone reads.
 */
const COLUMNS: GenericColumn<DeityRow>[] = [
  { label: "Pantheon", cell: (row) => row.pantheon ?? "—", nowrap: true },
  { label: "Title", cell: (row) => row.title ?? "—" },
  {
    label: "Alignment",
    cell: (row) => (row.alignment ? alignmentLabel(row.alignment) : "—"),
    nowrap: true,
    optional: true,
  },
  {
    label: "Domains",
    cell: (row) => deityDomains(row.domains),
    optional: true,
  },
];

const BASE = listHrefFor("deity");

/**
 * The deities browse view.
 *
 * The only list outside spells, items and creatures big enough to page — 494
 * rows, against the 135 the shared generic list was written for. Everything
 * about a god that is worth comparing is a short field, so this is a denser
 * table than the other lore lists and carries four columns.
 */
export default async function DeitiesPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const filters = {
    pantheons: readList(params, "pantheon"),
    domains: readList(params, "domain"),
    alignments: readList(params, "alignment"),
    q: readString(params, "q"),
  };

  // Facet counts are computed against the same filters, so the two overlap.
  const [list, facets] = await Promise.all([
    listDeities({ ...filters, page: readPage(params) }),
    deityFacets(filters),
  ]);

  const filtered = hasFilters(params, FILTER_KEYS);

  return (
    <BrowseColumns>
      <FilterRail collapsed={<CollapsedFilters params={params} />}>
        <DeityFilters params={params} facets={facets} />
      </FilterRail>

      <main id="main">
        <ListToolbar
          params={params}
          matched={list.total}
          filtered={filtered}
          basePath={BASE}
          noun={["deity", "deities"]}
          carriedKeys={FILTER_KEYS}
        />

        <GenericTable
          rows={list.rows}
          type="deity"
          columns={COLUMNS}
          noun="deities"
          filtered={filtered}
          open={openEntityAside.bind(null, "deity")}
        />

        <Pager
          params={params}
          page={list.page}
          pageCount={list.pageCount}
          basePath={BASE}
        />
      </main>
    </BrowseColumns>
  );
}
