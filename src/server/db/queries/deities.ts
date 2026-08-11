import { and, asc, count, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { alignmentLabel } from "@/lib/content/deities";
import { db } from "../client";
import { genericEntities } from "../schema/content";
import { entities } from "../schema/entities";
import { toOptions, type FacetOption } from "./facets";

/**
 * Deity list and facet queries.
 *
 * The only `generic_entities` type with a query module of its own, and it earns
 * one twice over. It is 494 rows, nearly four times the largest list
 * `listGeneric` was written for, so it pages like the spells and items do; and
 * its three facets are all inside the blob — a text field, and two JSON arrays
 * that have to be exploded before they can be counted.
 *
 * A pantheon is what makes this list usable at all: a reader looking for Bane
 * wants the Faerûnian one or the Dragonlance one, and there is no other way to
 * tell those two rows apart at a glance.
 */

export const DEITIES_PER_PAGE = 50;

const TYPE = eq(entities.entityType, "deity");

/** The blob fields the list and the facets both read. */
const PANTHEON = sql<string>`${genericEntities.data}->>'pantheon'`;
const DOMAINS = sql`${genericEntities.data}->'domains'`;
const ALIGNMENT = sql`${genericEntities.data}->'alignment'`;

/** `["C", "G"]` as `CG`, which is the value the rail filters by. */
const ALIGNMENT_CODE = sql<string>`(
  SELECT string_agg(code, '' ORDER BY ordinality)
  FROM jsonb_array_elements_text(${ALIGNMENT}) WITH ORDINALITY AS t(code, ordinality)
)`;

export interface DeityFilters {
  pantheons?: string[];
  /** Domain names as stored: "Knowledge", "War". */
  domains?: string[];
  /** Joined alignment codes: "CG", "N". */
  alignments?: string[];
  /** Name search. Substring, case-insensitive. */
  q?: string;
}

export interface DeityFacetOptions {
  pantheons: FacetOption<string>[];
  domains: FacetOption<string>[];
  alignments: FacetOption<string>[];
}

function buildWhere(f: DeityFilters, skip?: keyof DeityFilters): SQL | undefined {
  const clauses: SQL[] = [];

  /*
   * `inArray` rather than `= ANY(…)`. A JS array embedded in a `sql` template
   * is spread into one placeholder per element, so `ANY($2)` arrives holding a
   * single string and Postgres rejects it as a malformed array literal.
   */
  if (skip !== "pantheons" && f.pantheons?.length) {
    clauses.push(inArray(PANTHEON, f.pantheons));
  }

  // Overlap against a JSON array: a god belongs to every domain in its own
  // list, and picking two domains asks for a god with either. The function form
  // of `?|`, since the operator's `?` reads badly beside bound parameters.
  if (skip !== "domains" && f.domains?.length) {
    clauses.push(sql`jsonb_exists_any(${DOMAINS}, ${sql.param(f.domains)})`);
  }

  if (skip !== "alignments" && f.alignments?.length) {
    clauses.push(inArray(ALIGNMENT_CODE, f.alignments));
  }

  if (skip !== "q" && f.q?.trim()) {
    clauses.push(ilike(entities.name, `%${f.q.trim()}%`));
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export type DeityRow = Awaited<ReturnType<typeof listDeities>>["rows"][number];

/** One page of deities, plus the unpaginated total the pager needs. */
export async function listDeities(
  params: DeityFilters & { page?: number } = {},
) {
  const where = buildWhere(params);

  // Count first, not in parallel: the offset depends on the clamped page, and
  // clamping needs the total.
  const [total] = await db
    .select({ value: count() })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .where(where ? and(TYPE, where) : TYPE);

  const matched = total?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(matched / DEITIES_PER_PAGE));
  const page = Math.min(Math.max(1, params.page ?? 1), pageCount);

  const rows = await db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      pantheon: PANTHEON,
      title: sql<string | null>`${genericEntities.data}->>'title'`,
      alignment: ALIGNMENT_CODE,
      domains: sql<string | null>`${genericEntities.data}->>'domains'`,
    })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .where(where ? and(TYPE, where) : TYPE)
    /*
     * Name, then pantheon. 60 of the 494 share a name with a god from another
     * pantheon — there are three Banes and two Lolths — so name alone is not a
     * total order and those rows would otherwise reshuffle between requests.
     */
    .orderBy(asc(entities.name), asc(PANTHEON))
    .limit(DEITIES_PER_PAGE)
    .offset((page - 1) * DEITIES_PER_PAGE);

  return { rows, total: matched, page, pageCount };
}

export async function deityFacets(
  filters: DeityFilters = {},
): Promise<DeityFacetOptions> {
  const [pantheons, domains, alignments] = await Promise.all([
    facetCounts(PANTHEON, filters, "pantheons"),
    arrayFacetCounts(DOMAINS, filters, "domains"),
    facetCounts(ALIGNMENT_CODE, filters, "alignments"),
  ]);

  return {
    pantheons: toOptions(pantheons, filters.pantheons ?? [], (a, b) =>
      a.localeCompare(b),
    ),
    domains: toOptions(domains, filters.domains ?? [], (a, b) =>
      a.localeCompare(b),
    ),
    /*
     * Ordered by the words rather than by the codes, so the rail reads down the
     * alignment grid instead of grouping every chaotic god above every lawful
     * one because C sorts before L.
     */
    alignments: toOptions(
      alignments,
      filters.alignments ?? [],
      (a, b) => alignmentLabel(a).localeCompare(alignmentLabel(b)),
      alignmentLabel,
    ),
  };
}

/** Counts for a scalar blob field, against the *other* filters. */
async function facetCounts(
  column: SQL<string>,
  filters: DeityFilters,
  skip: keyof DeityFilters,
): Promise<{ value: string; n: number }[]> {
  const where = buildWhere(filters, skip);

  const rows = await db
    .select({
      value: column,
      n: sql<number>`count(*) FILTER (WHERE ${where ?? sql`true`})`,
    })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .where(TYPE)
    .groupBy(column);

  return rows
    .filter((row) => row.value != null)
    .map((row) => ({ value: row.value, n: Number(row.n) }));
}

/**
 * Counts for a JSON array field — the domains.
 *
 * A god belongs to every domain in its list, so the rows are exploded with a
 * LATERAL unnest before grouping, exactly as the creature sizes are. Counting
 * the array itself would make `["Knowledge", "War"]` its own facet value.
 */
async function arrayFacetCounts(
  column: SQL,
  filters: DeityFilters,
  skip: keyof DeityFilters,
): Promise<{ value: string; n: number }[]> {
  const where = buildWhere(filters, skip);
  const value = sql<string>`unnested.value`;

  const rows = await db
    .select({
      value,
      n: sql<number>`count(*) FILTER (WHERE ${where ?? sql`true`})`,
    })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .innerJoin(
      sql`LATERAL jsonb_array_elements_text(${column}) AS unnested(value)`,
      sql`true`,
    )
    .where(TYPE)
    .groupBy(value);

  return rows.map((row) => ({ value: row.value, n: Number(row.n) }));
}
