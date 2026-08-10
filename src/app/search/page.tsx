import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import { Pager } from "@/components/compendium/list-controls";
import {
  CollapsedFilters,
  SearchFilters,
} from "@/components/compendium/search-filters";
import {
  SearchPrompt,
  SearchResults,
  SearchToolbar,
} from "@/components/compendium/search-results";
import { BrowseColumns, FilterRail } from "@/components/layout";
import { AsideAutoOpen } from "@/components/compendium/aside-auto-open";
import { asideKey } from "@/lib/aside";
import {
  normalizeQuery,
  OPEN_PARAM,
  parseOpenParam,
} from "@/lib/content/search";
import { readList, readPage, readString, type QueryParams } from "@/lib/query-params";
import { searchEntities, searchFacets } from "@/server/db/queries/search";
import { entityTypeEnum, type EntityType } from "@/server/db/schema/enums";

const BASE = "/search";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search every spell, creature, item, rule and chapter in the compendium.",
};

/**
 * Corpus-wide search.
 *
 * The one view that is not about a single content type: a query reaches spells,
 * chapters, class features and cards at once, and ranking them against each
 * other is the whole of the problem — see `searchEntities`.
 *
 * Query, type filter and page live in the URL and nowhere else, so a result set
 * is linkable and the back button works, exactly as on the browse lists.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const raw = await searchParams;
  const query = normalizeQuery(readString(raw, "q"));
  const types = readTypes(raw);

  /*
   * `open` is an arrival instruction, not filter state, so it is taken off
   * before anything builds a link. Leaving it on would make every facet click
   * and every page of results re-open the same entity — including the one the
   * reader had just closed.
   */
  const params: QueryParams = { ...raw, [OPEN_PARAM]: undefined };
  const target = parseOpenParam(readString(raw, OPEN_PARAM));

  // Nothing to search for. The rail would have nothing to count and the list
  // would say "no matches", which is a lie when nothing was looked for.
  if (!query) {
    return (
      <main id="main">
        <SearchToolbar query={readString(params, "q") ?? ""} matched={null} types={types} />
        <SearchPrompt />
      </main>
    );
  }

  const page = readPage(params);

  const [results, facets] = await Promise.all([
    searchEntities({ q: query, types, page }),
    searchFacets(query, { types }),
  ]);

  return (
    <BrowseColumns>
      <FilterRail collapsed={<CollapsedFilters params={params} />}>
        <SearchFilters params={params} facets={facets} />
      </FilterRail>

      <main id="main">
        <SearchToolbar query={query} matched={results.total} types={types} />

        {/* The typeahead's payoff: a creature or an item has no page, so
            picking one from the dropdown lands here with it already open. */}
        {target ? (
          <AsideAutoOpen
            entityKey={asideKey(target.type, target.sourceId, target.slug)}
            // The URL carries a slug, not a name. The row is almost always in
            // these results — the query is the entity's own name — so take the
            // name from there rather than querying for it again.
            label={
              results.rows.find(
                (row) =>
                  row.entityType === target.type &&
                  row.sourceId.toLowerCase() === target.sourceId &&
                  row.slug === target.slug,
              )?.name
            }
            load={openEntityAside.bind(
              null,
              target.type,
              target.sourceId,
              target.slug,
            )}
          />
        ) : null}

        <SearchResults
          rows={results.rows}
          query={query}
          open={openEntityAside}
        />
        <Pager
          params={params}
          page={results.page}
          pageCount={results.pageCount}
          basePath={BASE}
        />
      </main>
    </BrowseColumns>
  );
}

/**
 * Validated against the enum rather than passed through: the value reaches an
 * `IN` clause on an enum column, where an unknown one is a database error
 * rather than an empty result.
 */
function readTypes(params: QueryParams): EntityType[] {
  const known = new Set<string>(entityTypeEnum.enumValues);

  return readList(params, "type").filter((value): value is EntityType =>
    known.has(value),
  );
}
