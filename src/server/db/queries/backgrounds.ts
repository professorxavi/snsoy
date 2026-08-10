import { and, arrayOverlaps, asc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "../client";
import { backgrounds } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";
import { toOptions, type FacetOption } from "./facets";

/**
 * Background list and detail queries.
 *
 * 96 rows, so no paging: the whole list is one query and one table, and a page
 * of 50 would only hide half of a set small enough to scan. That is the shape
 * every type in this batch takes.
 *
 * Ingest lifted the proficiencies out of the blob into `text[]` columns, so the
 * skill facet counts a column rather than parsing 96 JSON documents per
 * request.
 */

export interface BackgroundFilters {
  /** Skill names as stored: lowercase, "sleight of hand". */
  skills?: string[];
  /** Name search. Substring, case-insensitive. */
  q?: string;
}

export interface BackgroundFacetOptions {
  skills: FacetOption<string>[];
}

function buildWhere(
  f: BackgroundFilters,
  skip?: keyof BackgroundFilters,
): SQL | undefined {
  const clauses: SQL[] = [];

  // Overlap, not containment: picking Stealth and Deception asks for a
  // background granting either, which is how someone shops for one.
  if (skip !== "skills" && f.skills?.length)
    clauses.push(arrayOverlaps(backgrounds.skillProficiencies, f.skills));
  if (skip !== "q" && f.q?.trim())
    clauses.push(ilike(entities.name, `%${f.q.trim()}%`));

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export type BackgroundRow = Awaited<ReturnType<typeof listBackgrounds>>[number];

export async function listBackgrounds(filters: BackgroundFilters = {}) {
  return db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      skills: backgrounds.skillProficiencies,
      tools: backgrounds.toolProficiencies,
      languageCount: backgrounds.languageCount,
      featureName: backgrounds.featureName,
    })
    .from(backgrounds)
    .innerJoin(entities, eq(entities.id, backgrounds.entityId))
    .where(buildWhere(filters))
    /*
     * Name, then source. 8 backgrounds share a name with one from another book
     * — there are three Knights of Solamnia — and without the second key those
     * rows arrive in whatever order the scan produced.
     */
    .orderBy(asc(entities.name), asc(entities.sourceId));
}

export async function backgroundFacets(
  filters: BackgroundFilters = {},
): Promise<BackgroundFacetOptions> {
  const where = buildWhere(filters, "skills");
  const value = sql<string>`unnested.value`;

  // A background grants two skills, so its row is exploded before grouping —
  // counting the column directly would make `{insight,religion}` a facet value.
  const rows = await db
    .select({
      value,
      n: sql<number>`count(*) FILTER (WHERE ${where ?? sql`true`})`,
    })
    .from(backgrounds)
    .innerJoin(entities, eq(entities.id, backgrounds.entityId))
    .innerJoin(
      sql`LATERAL unnest(${backgrounds.skillProficiencies}) AS unnested(value)`,
      sql`true`,
    )
    .groupBy(value);

  return {
    skills: toOptions(
      rows.map((row) => ({ value: row.value, n: Number(row.n) })),
      filters.skills ?? [],
      (a, b) => a.localeCompare(b),
    ),
  };
}

/** One background for the aside. Unique on type, source and slug. */
export async function getBackground(sourceId: string, slug: string) {
  const [row] = await db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      page: entities.page,
      sourceName: sources.name,
      data: backgrounds.data,
    })
    .from(backgrounds)
    .innerJoin(entities, eq(entities.id, backgrounds.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    // Source ids are mixed case in the data but lowercase in URLs.
    .where(and(ilike(entities.sourceId, sourceId), eq(entities.slug, slug)))
    .limit(1);

  return row ?? null;
}
