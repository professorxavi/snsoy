import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  CollapsedFilters,
  FILTER_KEYS,
  ItemFilters,
} from "@/components/compendium/item-filters";
import { ItemTable } from "@/components/compendium/item-table";
import { ListToolbar, Pager } from "@/components/compendium/list-controls";
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
  BROWSED_ITEM_TYPES,
  itemFacets,
  listItems,
  type ItemCategory,
  type ItemFilters as ItemFilterValues,
  type ItemSort,
} from "@/server/db/queries/items";

export const metadata: Metadata = {
  title: "Items",
  description:
    "Weapons, armour, treasure and gear, filtered by rarity, type and attunement.",
};

const BASE = "/compendium/items";

/**
 * The item browse view. Filters, sort and page are read from the URL and
 * nowhere else, and resolved in the database rather than the browser.
 *
 * One list over two entity types — see `listItems`. The blend happens in the
 * query and nowhere near a URL: every row still links to its own segment.
 */
export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const filters = readFilters(params);
  const page = readPage(params);
  const sort = (readString(params, "sort") as ItemSort) ?? "name";

  // Facet counts are computed against the same filters, so the two overlap.
  const [list, facets] = await Promise.all([
    listItems({ ...filters, page, sort }),
    itemFacets(filters),
  ]);

  return (
    <BrowseColumns>
      <FilterRail collapsed={<CollapsedFilters params={params} />}>
        <ItemFilters params={params} facets={facets} />
      </FilterRail>

      <main id="main">
        <ListToolbar
          params={params}
          matched={list.total}
          filtered={hasFilters(params, FILTER_KEYS)}
          basePath={BASE}
          noun={["item", "items"]}
          carriedKeys={FILTER_KEYS}
        />
        <ItemTable rows={list.rows} params={params} open={openEntityAside} />
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
 * URL keys are short and singular; the query's are spelled out. `category` is
 * validated against the types the list actually covers rather than passed
 * through, since it reaches an `IN` clause on an enum column — an unknown value
 * would be a database error rather than an empty result, and `itemGroup` is a
 * real enum value that this list no longer browses.
 */
function readFilters(params: QueryParams): ItemFilterValues {
  const categories = readList(params, "category").filter((value): value is ItemCategory =>
    (BROWSED_ITEM_TYPES as readonly string[]).includes(value),
  );

  return {
    rarities: readList(params, "rarity"),
    types: readList(params, "type"),
    categories,
    sources: readList(params, "source"),
    attunement: readBoolean(params, "attunement"),
    magic: readBoolean(params, "magic"),
    q: readString(params, "q"),
  };
}
