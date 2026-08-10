import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  CollapsedFilters,
  FeatFilters,
  FILTER_KEYS,
} from "@/components/compendium/feat-filters";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import { BrowseColumns, FilterRail } from "@/components/layout";
import { abilityName } from "@/lib/content/dnd";
import { featPrerequisite } from "@/lib/content/feats";
import {
  hasFilters,
  readBoolean,
  readList,
  readString,
  type QueryParams,
} from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { featFacets, listFeats, type FeatRow } from "@/server/db/queries/feats";

export const metadata: Metadata = {
  title: "Feats",
  description:
    "Every feat, filtered by the ability it raises and whether anything is required to take it.",
};

/**
 * The prerequisite is the column, because it is the one fact a feat's own text
 * never states — see `featPrerequisite`. "Raises" repeats what the rail
 * filters, which is what makes a filtered list readable: a row that survived
 * the Dexterity facet should say so.
 */
const COLUMNS: GenericColumn<FeatRow>[] = [
  {
    label: "Raises",
    cell: (row) => abilityList(row.abilities),
    nowrap: true,
  },
  { label: "Prerequisite", cell: (row) => featPrerequisite(row.prerequisites) ?? "—" },
];

/**
 * Six abilities means a free choice, which is how 30 of the 51 increases are
 * written. Naming all six would be a cell of noise where "Any" is the fact.
 */
function abilityList(codes: string[] | null): string {
  if (!codes || codes.length === 0) return "—";
  if (codes.length >= 6) return "Any";

  return codes.map(abilityName).join(", ");
}

const BASE = listHrefFor("feat");

/**
 * The feats browse view.
 *
 * 105 rows, no pager. Nobody cites a feat in book prose — 167 inbound links
 * against a spell's thousands — and everybody looks one up directly, which is
 * why this list is worth building despite the count.
 */
export default async function FeatsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const filters = {
    abilities: readList(params, "ability"),
    open: readBoolean(params, "open"),
    q: readString(params, "q"),
  };

  const [rows, facets] = await Promise.all([
    listFeats(filters),
    featFacets(filters),
  ]);

  const filtered = hasFilters(params, FILTER_KEYS);

  return (
    <BrowseColumns>
      <FilterRail collapsed={<CollapsedFilters params={params} />}>
        <FeatFilters params={params} facets={facets} />
      </FilterRail>

      <main id="main">
        <ListToolbar
          params={params}
          matched={rows.length}
          filtered={filtered}
          basePath={BASE}
          noun={["feat", "feats"]}
          carriedKeys={FILTER_KEYS}
        />

        <GenericTable
          rows={rows}
          type="feat"
          columns={COLUMNS}
          noun="feats"
          filtered={filtered}
          open={openEntityAside.bind(null, "feat")}
        />
      </main>
    </BrowseColumns>
  );
}
