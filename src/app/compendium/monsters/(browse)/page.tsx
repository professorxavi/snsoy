import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import { ListToolbar, Pager } from "@/components/compendium/list-controls";
import {
  CollapsedFilters,
  FILTER_KEYS,
  MonsterFilters,
} from "@/components/compendium/monster-filters";
import { MonsterTable } from "@/components/compendium/monster-table";
import { BrowseColumns, FilterRail } from "@/components/layout";
import {
  hasFilters,
  readBoolean,
  readList,
  readPage,
  readString,
  type QueryParams,
} from "@/lib/query-params";
import {
  listMonsters,
  monsterFacets,
  type MonsterFilters as MonsterFilterValues,
  type MonsterSort,
} from "@/server/db/queries/monsters";

export const metadata: Metadata = {
  title: "Creatures",
  description:
    "Every creature, filtered by challenge rating, type, size and environment.",
};

const BASE = "/compendium/monsters";

/**
 * The creature browse view. Filters, sort and page are read from the URL and
 * nowhere else, and resolved in the database rather than the browser — at 3,628
 * creatures this list cannot be sent whole, which is what the shape was built
 * for.
 */
export default async function MonstersPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const filters = readFilters(params);
  const page = readPage(params);
  const sort = (readString(params, "sort") as MonsterSort) ?? "name";

  // Facet counts are computed against the same filters, so the two overlap.
  const [list, facets] = await Promise.all([
    listMonsters({ ...filters, page, sort }),
    monsterFacets(filters),
  ]);

  return (
    <BrowseColumns>
      <FilterRail collapsed={<CollapsedFilters params={params} />}>
        <MonsterFilters params={params} facets={facets} />
      </FilterRail>

      <main id="main">
        <ListToolbar
          params={params}
          matched={list.total}
          filtered={hasFilters(params, FILTER_KEYS)}
          basePath={BASE}
          noun={["creature", "creatures"]}
          carriedKeys={FILTER_KEYS}
        />
        <MonsterTable
          rows={list.rows}
          params={params}
          open={openEntityAside.bind(null, "monster")}
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

/**
 * URL keys are short; the query's are spelled out. `caster` rather than
 * `spellcaster` and `env` rather than `environment` keep a filtered URL
 * readable when four facets are set at once.
 */
function readFilters(params: QueryParams): MonsterFilterValues {
  return {
    crs: readList(params, "cr"),
    types: readList(params, "type"),
    sizes: readList(params, "size"),
    environments: readList(params, "env"),
    sources: readList(params, "source"),
    legendary: readBoolean(params, "legendary"),
    spellcaster: readBoolean(params, "caster"),
    q: readString(params, "q"),
  };
}
