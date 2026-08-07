import type { Metadata } from "next";
import { ListToolbar, Pager } from "@/components/compendium/list-chrome";
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

export const metadata: Metadata = {
  title: "Spells",
  description:
    "Every spell, filtered by level, school, casting time and class.",
};

/**
 * The spell browse view.
 *
 * Filters are read out of the URL and nowhere else, so this component is a pure
 * function of the address bar. That is what makes a filtered list linkable and
 * the back button correct, and it is why the rail can be plain links with no
 * client state behind them.
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

  // The facet counts are computed against the same filters, so they overlap.
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
        />
        <SpellTable rows={list.rows} params={params} />
        <Pager
          params={params}
          page={list.page}
          pageCount={list.pageCount}
          basePath="/compendium/spells"
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
