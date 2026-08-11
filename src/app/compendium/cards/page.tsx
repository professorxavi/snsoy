import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  CardFilters,
  CollapsedFilters,
  FILTER_KEYS,
} from "@/components/compendium/card-filters";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar, Pager } from "@/components/compendium/list-controls";
import { BrowseColumns, FilterRail } from "@/components/layout";
import { cardRank } from "@/lib/content/cards";
import {
  hasFilters,
  readList,
  readPage,
  readString,
  type QueryParams,
} from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { cardFacets, listCards, type CardRow } from "@/server/db/queries/cards";

export const metadata: Metadata = {
  title: "Cards",
  description:
    "Every card the books deal, filtered by the deck it belongs to.",
};

/**
 * The deck comes first and never sheds: five decks deal a Jester, so a reader
 * who loses it cannot tell two rows apart. Rank is the tarot and tarokka half
 * of the type — 168 of the 656 have one — and sheds when the panel opens.
 */
const COLUMNS: GenericColumn<CardRow>[] = [
  { label: "Deck", cell: (row) => row.deck ?? "—", nowrap: true },
  {
    label: "Rank",
    cell: (row) => cardRank(row) || "—",
    nowrap: true,
    optional: true,
  },
];

const BASE = listHrefFor("card");

/**
 * The cards browse view.
 *
 * Kept apart from `/compendium/decks` because a card and a deck answer
 * different questions. Paged at 50 like the deities and the spells: 656 rows is
 * five times what the shared generic list was written for.
 */
export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const filters = {
    decks: readList(params, "deck"),
    q: readString(params, "q"),
  };

  // Facet counts are computed against the same filters, so the two overlap.
  const [list, facets] = await Promise.all([
    listCards({ ...filters, page: readPage(params) }),
    cardFacets(filters),
  ]);

  const filtered = hasFilters(params, FILTER_KEYS);

  return (
    <BrowseColumns>
      <FilterRail collapsed={<CollapsedFilters params={params} />}>
        <CardFilters params={params} facets={facets} />
      </FilterRail>

      <main id="main">
        <ListToolbar
          params={params}
          matched={list.total}
          filtered={filtered}
          basePath={BASE}
          noun={["card", "cards"]}
          carriedKeys={FILTER_KEYS}
        />

        <GenericTable
          rows={list.rows}
          type="card"
          columns={COLUMNS}
          noun="cards"
          filtered={filtered}
          open={openEntityAside.bind(null, "card")}
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
