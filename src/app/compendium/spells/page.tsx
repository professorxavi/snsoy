import type { Metadata } from "next";
import { ListToolbar, Pager } from "@/components/compendium/list-controls";
import {
  CollapsedFilters,
  FILTER_KEYS,
  SpellFilters,
} from "@/components/compendium/spell-filters";
import { SpellTable } from "@/components/compendium/spell-table";
import { BrowseColumns, FilterRail } from "@/components/layout";
import {
  hasFilters,
  readBoolean,
  readList,
  readNumberList,
  readPage,
  readString,
  type QueryParams,
} from "@/lib/query-params";
import {
  listSpells,
  spellFacets,
  type SpellFilters as SpellFilterValues,
  type SpellSort,
} from "@/server/db/queries/spells";
import { openEntityAside } from "@/app/aside-actions";

export const metadata: Metadata = {
  title: "Spells",
  description:
    "Every spell, filtered by level, school, casting time and class.",
};

const BASE = "/compendium/spells";

/**
 * The spell browse view. Filters, sort and page are read from the URL and
 * nowhere else, and resolved in the database rather than the browser — the
 * larger content types to come cannot be sent whole.
 */
export default async function SpellsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const filters = readFilters(params);
  const page = readPage(params);
  const sort = (readString(params, "sort") as SpellSort) ?? "name";

  // Facet counts are computed against the same filters, so the two overlap.
  const [list, facets] = await Promise.all([
    listSpells({ ...filters, page, sort }),
    spellFacets(filters),
  ]);

  return (
    <BrowseColumns>
      <FilterRail collapsed={<CollapsedFilters params={params} />}>
        <SpellFilters params={params} facets={facets} />
      </FilterRail>

      <main id="main">
        <ListToolbar
          params={params}
          matched={list.total}
          filtered={hasFilters(params, FILTER_KEYS)}
          basePath={BASE}
        />
        <SpellTable
          rows={list.rows}
          params={params}
          open={openEntityAside.bind(null, "spell")}
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

function readFilters(params: QueryParams): SpellFilterValues {
  return {
    levels: readNumberList(params, "level"),
    schools: readList(params, "school"),
    castingTimes: readList(params, "time"),
    classes: readList(params, "class"),
    sources: readList(params, "source"),
    concentration: readBoolean(params, "conc"),
    ritual: readBoolean(params, "ritual"),
    q: readString(params, "q"),
  };
}
