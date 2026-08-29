import { sql, type SQL } from "drizzle-orm";
import { MATCH_END, MATCH_START } from "@/lib/content/search";
import { hrefFor } from "@/lib/routes";
import type { EntityType } from "@/server/db/schema/enums";
import { races } from "../schema/content";
import { db } from "../client";
import { toOptions, type FacetOption } from "./facets";
import { SAYS_NOTHING } from "./races";
import { ancestorsOf, fetchAncestry } from "./references";

/**
 * Search across the books.
 *
 * Ranking is the whole difficulty here, and it is not what `ts_rank` measures.
 * `ts_rank` scores a document against a query; what a reader typing "fireball"
 * wants is the entity *named* Fireball, which is a different question. The two
 * come apart badly: with `ts_rank` alone the spell everyone means arrives
 * seventh, behind a Waterdeep chapter named after a tavern, two magic items and
 * a recipe card, because a 59,000-character chapter that says "fireball" forty
 * times genuinely is a better textual match than the 842-character spell.
 *
 * None of `ts_rank`'s normalisation flags fix that — measured over all four,
 * the chapter stays first — because weight 'A' is binary. It records that the
 * term appeared in the name, not that the name *is* the term.
 *
 * So the name is scored as a string rather than as a tsvector, and results are
 * ordered by **match tier first**:
 *
 * | tier | the name…              | example for "fire"  |
 * |------|------------------------|---------------------|
 * | 3    | is exactly the query   | Fire (subrace)      |
 * | 2    | starts with the query  | Fire Bolt           |
 * | 1    | contains the query     | Wall of Fire        |
 * | 0    | only the body matched  | Efreeti             |
 *
 * A lexicographic tier is worth more than the weighted sum it replaced: it is
 * provable. No accumulation of body relevance can lift a passing mention above
 * an exact name match, however long the passage or however often it repeats the
 * word — which was the entire failure being fixed. Within a tier the score
 * breaks ties, and there the three signals are commensurate.
 *
 * Full-text is still what gives *recall*: it stems ("fireballs" finds Fireball)
 * and it reaches prose, which is the only way to answer "opportunity attack"
 * when the rule is buried in a chapter. Trigram similarity covers the third
 * case — a typo. "magic missle" matches nothing textually at all and still
 * lands on Magic Missile, because similarity does not need the word to be
 * spelled right.
 */

export const RESULTS_PER_PAGE = 20;

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

/**
 * How likely a type is to be what someone meant, used only to break ties inside
 * a tier. It never reorders tiers, so this can be tuned freely without the
 * ordering guarantee above coming apart.
 *
 * The bands are judgements about the question, not about the data. Cards and
 * decks sit at the bottom because a boxed set reprints items and conditions
 * verbatim on cardboard: "Grappled" is one condition and two identical cards,
 * and the condition is the one being asked for every time. Chapters sit low for
 * the mirror-image reason — a chapter *about* a thing is rarely a better answer
 * than the thing.
 */
const PROMINENCE: Partial<Record<EntityType, number>> = {
  spell: 0.5,
  monster: 0.5,
  item: 0.5,
  baseitem: 0.5,
  class: 0.5,
  race: 0.5,
  feat: 0.5,
  background: 0.5,
  condition: 0.5,

  subclass: 0.4,
  subrace: 0.4,
  classFeature: 0.4,
  subclassFeature: 0.4,
  optionalfeature: 0.4,
  skill: 0.4,
  action: 0.4,
  sense: 0.4,
  status: 0.4,
  itemGroup: 0.4,

  bookSection: 0.2,
  recipe: 0.1,
  card: 0.05,
  deck: 0.05,
};

/** Everything not named above: the long tail of lore and DM tools. */
const DEFAULT_PROMINENCE = 0.3;

/** `PROMINENCE` as a SQL expression, so the table above stays the only copy. */
function prominenceCase(): SQL {
  return sql`CASE si.entity_type ${sql.join(
    Object.entries(PROMINENCE).map(
      ([type, weight]) => sql`WHEN ${type} THEN ${weight}::real`,
    ),
    sql` `,
  )} ELSE ${DEFAULT_PROMINENCE}::real END`;
}

/* ------------------------------------------------------------------ *
 * Name tiers
 * ------------------------------------------------------------------ */

/**
 * The query as a `LIKE` pattern operand, with its wildcards defused.
 *
 * `%` and `_` in a query are literal characters someone typed, not wildcards:
 * `bag of holding_` should find nothing, rather than every fifteen-character
 * name beginning "bag of holding". The backslash goes first, or escaping the
 * other two would double-escape it.
 */
const ESCAPED_QUERY: SQL = sql`
  replace(replace(replace(q.raw, '\\', '\\\\'), '%', '\\%'), '_', '\\_')
`;

/**
 * Rows the reader has no way to open, kept out of the results.
 *
 * The index is built at ingest and knows nothing about what the pages choose to
 * render, so anything hidden downstream has to be excluded here too — otherwise
 * searching finds a row whose link lands on an anchor that is no longer on the
 * page. One thing meets this today: the tiefling's Asmodeus bloodline, which
 * carries no rules and is left off its parent's page. See `SAYS_NOTHING`.
 *
 * Applied to the counts as well as the rows, or the facet rail would offer a
 * subrace that the result list then declines to show.
 */
const REACHABLE: SQL = sql`
  NOT EXISTS (
    SELECT 1 FROM ${races}
    WHERE ${races.entityId} = si.entity_id AND (${SAYS_NOTHING})
  )
`;

/**
 * Which tier a row matched in. `LIKE` rather than a regular expression because
 * the pattern is user text either way, and `LIKE` has two metacharacters to
 * defuse where a regex has a dozen.
 */
const TIER: SQL = sql`
  CASE
    WHEN lower(unaccent(si.name)) = q.raw THEN 3
    WHEN lower(unaccent(si.name)) LIKE ${ESCAPED_QUERY} || '%' THEN 2
    WHEN lower(unaccent(si.name)) LIKE '%' || ${ESCAPED_QUERY} || '%' THEN 1
    ELSE 0
  END
`;

/* ------------------------------------------------------------------ *
 * Parameters
 * ------------------------------------------------------------------ */

export interface SearchFilters {
  /** Narrow to these entity types. Empty means every type. */
  types?: EntityType[];
}

export interface SearchParams extends SearchFilters {
  /** Already normalised — see `normalizeQuery`. */
  q: string;
  page?: number;
  perPage?: number;
}

export interface SearchResult {
  id: string;
  name: string;
  entityType: EntityType;
  sourceId: string;
  slug: string;
  /**
   * Which tier the name matched in, 3 down to 0. Not used for display; it is
   * the one part of the ranking a test can assert on directly, and it is what
   * makes "the query is data, not syntax" checkable.
   */
  tier: number;
  /**
   * A passage from the entity's prose with the matched words delimited, or null
   * where the row needs no explaining. Parse it with `parseSnippet` — never
   * insert it as markup.
   */
  snippet: string | null;
  /** Null for a fragment whose parent is missing, and for typeless entities. */
  href: string | null;
  /**
   * The entity a fragment renders inside: "Rogue" for Sneak Attack, "Genasi"
   * for the Fire subrace. Null for everything that stands on its own.
   *
   * Without it a fragment row is unreadable — 847 subclass features and 69
   * subraces carry names like "Fire" and "Extra Attack" that mean nothing at
   * all outside the thing they belong to.
   */
  parentName: string | null;
}

export interface SearchPage {
  rows: SearchResult[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

/* ------------------------------------------------------------------ *
 * The query
 * ------------------------------------------------------------------ */

/** Raw row shape, before fragments are given their parent. */
interface ScoredRow {
  id: string;
  name: string;
  entityType: EntityType;
  sourceId: string;
  slug: string;
  naturalKey: string;
  tier: number;
  snippet: string | null;
  total: string | number;
}

/**
 * One page of results, ranked.
 *
 * A single statement, in four stages: reduce the books to candidates through
 * the two indexes, score them, take the page, and only then compute headlines.
 * The order matters — `ts_headline` re-parses the whole body, and the broadest
 * query in the books ("damage") reaches 6,726 rows. Running it before the
 * limit would mean paying that 6,726 times to print twenty snippets.
 */
export async function searchEntities(
  params: SearchParams,
): Promise<SearchPage> {
  const perPage = params.perPage ?? RESULTS_PER_PAGE;
  const requested = Math.max(1, params.page ?? 1);
  const offset = (requested - 1) * perPage;

  const rows = (await db.execute(sql`
    WITH q AS (
      SELECT websearch_to_tsquery('english', ${params.q}) AS tsq,
             lower(unaccent(${params.q}))                 AS raw
    ),
    scored AS (
      SELECT
        si.entity_id,
        si.name,
        si.entity_type,
        si.source_id,
        si.body,
        si.tsv @@ q.tsq AS body_matched,
        ${TIER} AS tier,
        similarity(lower(unaccent(si.name)), q.raw)
          + 0.5 * ts_rank(si.tsv, q.tsq)
          + ${prominenceCase()} AS score
      FROM search_index si, q
      WHERE (si.tsv @@ q.tsq OR si.name % q.raw)
        AND ${REACHABLE}
        ${typeClause(params.types)}
    ),
    paged AS (
      SELECT *, count(*) OVER () AS total
      FROM scored
      -- Name and source last, so paging through equal scores is stable.
      ORDER BY tier DESC, score DESC, name, source_id
      LIMIT ${perPage} OFFSET ${offset}
    )
    SELECT
      p.entity_id                          AS "id",
      p.name                               AS "name",
      p.entity_type                        AS "entityType",
      p.source_id                          AS "sourceId",
      p.tier                               AS "tier",
      p.total                              AS "total",
      e.slug                               AS "slug",
      e.natural_key                        AS "naturalKey",
      CASE WHEN p.tier = 0 AND p.body_matched
           THEN ts_headline('english', p.body, q.tsq, ${HEADLINE_OPTIONS})
      END                                  AS "snippet"
    FROM paged p
    JOIN entities e ON e.id = p.entity_id, q
    ORDER BY p.tier DESC, p.score DESC, p.name, p.source_id
  `)) as unknown as ScoredRow[];

  const total = Number(rows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const addressed = await withParents(rows);

  return {
    rows: addressed.map((row) => ({
      id: row.id,
      name: row.name,
      entityType: row.entityType,
      sourceId: row.sourceId,
      slug: row.slug,
      tier: Number(row.tier),
      snippet: row.snippet,
      href: row.href,
      parentName: row.parentName,
    })),
    total,
    page: Math.min(requested, pageCount),
    perPage,
    pageCount,
  };
}

/**
 * How much of the body a snippet shows, and what marks the matched words.
 *
 * One fragment, not several: a result row is two lines, and `ts_headline`'s
 * multi-fragment output stitches unrelated sentences together with an ellipsis
 * into something that reads as a non-sequitur.
 *
 * **A snippet is produced only where it explains something the row does not
 * already say**, which is a narrower case than it first appears, for two
 * reasons measured against the real index:
 *
 * - *The name already matched* (tier 1 and above). The indexed body opens with
 *   a metadata preamble — the entity's own name, then every source that
 *   reprints it, then loose enum values — so a query that matched the name
 *   matches that preamble too, densely, and `ts_headline` picks it every time.
 *   The snippet for Wand of Fireballs came back "Wand of Fireballs DMG CoA OoW
 *   SKT WDMM WD|DMG major rare", which tells a reader nothing they cannot see
 *   in the row above it.
 *
 * - *The body did not match at all.* A row reached by trigram alone — the
 *   misspelling case — has no matching lexeme anywhere in it, and `ts_headline`
 *   answers a query it cannot find by returning the head of the document. That
 *   is the same preamble again, this time with nothing highlighted in it.
 *
 * What is left is exactly the rows that need explaining: the ones whose name
 * does not contain the query and whose prose does.
 */
const HEADLINE_OPTIONS = [
  `StartSel=${MATCH_START}`,
  `StopSel=${MATCH_END}`,
  "MaxWords=32",
  "MinWords=16",
  "MaxFragments=1",
  "ShortWord=2",
].join(", ");

function typeClause(types: EntityType[] | undefined): SQL {
  if (!types?.length) return sql``;
  return sql` AND si.entity_type IN (${sql.join(
    types.map((type) => sql`${type}`),
    sql`, `,
  )})`;
}

/* ------------------------------------------------------------------ *
 * Fragment parents
 * ------------------------------------------------------------------ */

/** The minimum a row needs before it can be addressed. */
interface Addressable {
  entityType: EntityType;
  sourceId: string;
  slug: string;
  naturalKey: string;
}

/** What resolving a parent adds. */
interface Addressed {
  href: string | null;
  parentName: string | null;
}

/**
 * Give every fragment row its parent's name and URL.
 *
 * The same walk `resolveReferences` performs, through the same helper, and for
 * the same reason: a fragment's natural key already carries its parent's
 * identity, so ancestry is a lookup by unique key rather than a join that would
 * have to know four different parent shapes. Sharing it is deliberate — when
 * this was a second copy that stopped at one parent, both copies were wrong
 * about subclass features in the same way.
 *
 * Shared by the results page and the typeahead, which need it identically —
 * both print "Sneak Attack — Rogue" and both have to reach the anchor on the
 * Rogue's page rather than a URL a class feature does not have.
 */
async function withParents<T extends Addressable>(
  rows: T[],
): Promise<(T & Addressed)[]> {
  const ancestry = await fetchAncestry(rows);

  return rows.map((row) => {
    const chain = ancestorsOf(row, ancestry);

    return {
      ...row,
      href: hrefFor(row, ...chain),
      parentName: chain[0]?.name ?? null,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Typeahead
 * ------------------------------------------------------------------ */

/**
 * Eight. The list hangs under the top bar over whatever page is being read, and
 * it has to be scannable in the time between keystrokes — past about eight rows
 * a reader stops reading it and reaches for the results page instead, which is
 * what the footer link is for.
 */
export const SUGGESTION_LIMIT = 8;

export interface Suggestion {
  id: string;
  name: string;
  entityType: EntityType;
  sourceId: string;
  slug: string;
  href: string | null;
  parentName: string | null;
}

/**
 * The typeahead's rows: **name matches only**.
 *
 * Deliberately a narrower question than `searchEntities` answers, not a
 * truncation of it. Typeahead is a jump-to-a-thing affordance — the reader has
 * something in mind and is spelling it — whereas a body match is a discovery,
 * and a discovery cannot justify itself in a dropdown row that has no space for
 * the snippet explaining why it is there. Prose belongs on the results page,
 * one keystroke away through the footer link.
 *
 * "Name match" still includes the misspelling: a row reached by trigram alone
 * has tier 0, so the filter is "the name is *related to* the query" rather than
 * "the name contains it". Dropping that would lose exactly the case typeahead
 * is most useful for — you cannot spell it, which is why you are typing slowly.
 */
export async function suggestEntities(
  q: string,
  limit: number = SUGGESTION_LIMIT,
): Promise<Suggestion[]> {
  const rows = (await db.execute(sql`
    WITH q AS (
      SELECT websearch_to_tsquery('english', ${q}) AS tsq,
             lower(unaccent(${q}))                 AS raw
    ),
    scored AS (
      SELECT
        si.entity_id,
        si.name,
        si.entity_type,
        si.source_id,
        ${TIER} AS tier,
        si.name % q.raw AS name_similar,
        similarity(lower(unaccent(si.name)), q.raw)
          + 0.5 * ts_rank(si.tsv, q.tsq)
          + ${prominenceCase()} AS score
      FROM search_index si, q
      WHERE (si.tsv @@ q.tsq OR si.name % q.raw)
        AND ${REACHABLE}
    ),
    literal AS (
      SELECT bool_or(tier > 0) AS any FROM scored
    )
    SELECT
      s.entity_id   AS "id",
      s.name        AS "name",
      s.entity_type AS "entityType",
      s.source_id   AS "sourceId",
      e.slug        AS "slug",
      e.natural_key AS "naturalKey"
    FROM scored s
    JOIN entities e ON e.id = s.entity_id
    CROSS JOIN literal l
    -- The one clause that separates this from the results page: a row whose
    -- name says nothing about the query is a body match, and belongs there.
    --
    -- A merely trigram-similar name is the typo fallback, so it is admitted
    -- only when nothing matched literally. Otherwise a query with fewer hits
    -- than the limit pads the list out with near-misses — six names carry
    -- "fireball", and the last two rows would be "Fire" and "Wall of Fire".
    WHERE s.tier > 0 OR (s.name_similar AND NOT l.any)
    ORDER BY s.tier DESC, s.score DESC, s.name, s.source_id
    LIMIT ${limit}
  `)) as unknown as {
    id: string;
    name: string;
    entityType: EntityType;
    sourceId: string;
    slug: string;
    naturalKey: string;
  }[];

  const addressed = await withParents(rows);

  return addressed.map((row) => ({
    id: row.id,
    name: row.name,
    entityType: row.entityType,
    sourceId: row.sourceId,
    slug: row.slug,
    href: row.href,
    parentName: row.parentName,
  }));
}

/* ------------------------------------------------------------------ *
 * Facets
 * ------------------------------------------------------------------ */

export interface SearchFacetOptions {
  types: FacetOption<EntityType>[];
}

/**
 * How many results each type would leave.
 *
 * Counted over the *unfiltered* candidate set — the type facet is the only
 * filter there is, so counting it against itself would leave every other option
 * reading zero the moment one was chosen. No scoring and no headlines here:
 * ranking cannot change a count, so this pays only for the two index scans.
 *
 * Type is the whole rail. A source facet would list around 120 books, which is
 * a database browser rather than a way to find a spell, and the discrimination
 * a reader actually wants from a result list is "the condition, not the card".
 */
export async function searchFacets(
  q: string,
  filters: SearchFilters = {},
): Promise<SearchFacetOptions> {
  const rows = (await db.execute(sql`
    WITH q AS (
      SELECT websearch_to_tsquery('english', ${q}) AS tsq,
             lower(unaccent(${q}))                 AS raw
    )
    SELECT si.entity_type AS "value", count(*) AS "n"
    FROM search_index si, q
    WHERE (si.tsv @@ q.tsq OR si.name % q.raw)
      AND ${REACHABLE}
    GROUP BY si.entity_type
  `)) as unknown as { value: EntityType; n: string }[];

  const counted = rows.map((row) => ({
    value: row.value,
    n: Number(row.n),
  }));

  return {
    // Commonest first: the rail is a picture of what was found, and for a
    // result set spanning a dozen types an alphabetical list buries the answer.
    types: toOptions(
      counted,
      filters.types ?? [],
      (a, b) =>
        (counted.find((row) => row.value === b)?.n ?? 0) -
        (counted.find((row) => row.value === a)?.n ?? 0),
    ),
  };
}
