import {
  and,
  arrayOverlaps,
  asc,
  eq,
  ilike,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  FEATURE_TYPE_CODES,
  featureTypeLabel,
  formatPrerequisites,
  type OptionalFeatureIndex,
} from "@/lib/content/optional-features";
import { db } from "../client";
import { optionalFeatures } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";
import { toOptions, type FacetOption } from "./facets";

/**
 * Loading the options a class's features tell you to choose between.
 *
 * Two ways in, because the corpus offers two. A feature that names its options
 * ("choose one of the following") is read by key; one that only says a list
 * exists — every invocation, maneuver and infusion — is read by the feature-type
 * codes on the class's progression. Both land in the same index, so the
 * renderer never has to know which way an option arrived.
 */

export type OptionalFeatureRow = Awaited<
  ReturnType<typeof listOptionalFeaturesByKey>
>[number];

function selectOptionalFeatures(where: SQL) {
  return db
    .select({
      naturalKey: entities.naturalKey,
      name: entities.name,
      sourceId: entities.sourceId,
      sourceName: sources.name,
      page: entities.page,
      featureTypes: optionalFeatures.featureTypes,
      prerequisites: optionalFeatures.prerequisites,
      data: optionalFeatures.data,
    })
    .from(optionalFeatures)
    .innerJoin(entities, eq(entities.id, optionalFeatures.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(where)
    .orderBy(asc(entities.name));
}

/** Options a feature names, addressed by natural key. */
export async function listOptionalFeaturesByKey(keys: string[]) {
  if (keys.length === 0) return [];
  return selectOptionalFeatures(inArray(entities.naturalKey, keys));
}

/**
 * Every option of a kind — "EI" is all 54 eldritch invocations. Overlap rather
 * than containment, so an option carrying both `FS:F` and `FS:R` is found by
 * either; it is the same index the spell filters use.
 */
export async function listOptionalFeaturesByType(types: string[]) {
  if (types.length === 0) return [];
  return selectOptionalFeatures(arrayOverlaps(optionalFeatures.featureTypes, types));
}

/* ------------------------------------------------------------------ *
 * The browse list
 * ------------------------------------------------------------------ */

/**
 * The two readers above serve a *class page* — they answer "what can this
 * feature choose from". What follows serves the browse list, which asks the
 * opposite question: all 151 options at once, narrowed by kind.
 */

export interface OptionalFeatureFilters {
  /** Feature-type codes: "EI", "MV:B". */
  kinds?: string[];
  /** Name search. Substring, case-insensitive. */
  q?: string;
}

export interface OptionalFeatureFacetOptions {
  kinds: FacetOption<string>[];
}

function buildWhere(
  f: OptionalFeatureFilters,
  skip?: keyof OptionalFeatureFilters,
): SQL | undefined {
  const clauses: SQL[] = [];

  if (skip !== "kinds" && f.kinds?.length)
    clauses.push(arrayOverlaps(optionalFeatures.featureTypes, f.kinds));
  if (skip !== "q" && f.q?.trim())
    clauses.push(ilike(entities.name, `%${f.q.trim()}%`));

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export type OptionalFeatureListRow = Awaited<
  ReturnType<typeof listOptionalFeatures>
>[number];

export async function listOptionalFeatures(
  filters: OptionalFeatureFilters = {},
) {
  return db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      featureTypes: optionalFeatures.featureTypes,
      prerequisites: optionalFeatures.prerequisites,
    })
    .from(optionalFeatures)
    .innerJoin(entities, eq(entities.id, optionalFeatures.entityId))
    .where(buildWhere(filters))
    .orderBy(asc(entities.name), asc(entities.sourceId));
}

export async function optionalFeatureFacets(
  filters: OptionalFeatureFilters = {},
): Promise<OptionalFeatureFacetOptions> {
  const where = buildWhere(filters, "kinds");
  const value = sql<string>`unnested.value`;

  // 25 options carry two codes — a fighting style shared between two classes is
  // one entity in both lists — so the rows are exploded before grouping.
  const rows = await db
    .select({
      value,
      n: sql<number>`count(*) FILTER (WHERE ${where ?? sql`true`})`,
    })
    .from(optionalFeatures)
    .innerJoin(entities, eq(entities.id, optionalFeatures.entityId))
    .innerJoin(
      sql`LATERAL unnest(${optionalFeatures.featureTypes}) AS unnested(value)`,
      sql`true`,
    )
    .groupBy(value);

  return {
    kinds: toOptions(
      rows.map((row) => ({ value: row.value, n: Number(row.n) })),
      filters.kinds ?? [],
      // By how many options each kind has, which is the order the labels are
      // declared in. An unknown code sorts last rather than first.
      (a, b) => rank(a) - rank(b),
      featureTypeLabel,
    ),
  };
}

function rank(code: string): number {
  const index = FEATURE_TYPE_CODES.indexOf(code);
  return index === -1 ? FEATURE_TYPE_CODES.length : index;
}

/** One option for the aside. */
export async function getOptionalFeature(sourceId: string, slug: string) {
  const [row] = await db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      page: entities.page,
      sourceName: sources.name,
      featureTypes: optionalFeatures.featureTypes,
      prerequisites: optionalFeatures.prerequisites,
      data: optionalFeatures.data,
    })
    .from(optionalFeatures)
    .innerJoin(entities, eq(entities.id, optionalFeatures.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(and(ilike(entities.sourceId, sourceId), eq(entities.slug, slug)))
    .limit(1);

  return row ?? null;
}

/** Rows into the index the renderer reads. */
export function indexOptionalFeatures(
  rows: OptionalFeatureRow[],
): OptionalFeatureIndex {
  const index: OptionalFeatureIndex = {};

  for (const row of rows) {
    index[row.naturalKey] = {
      name: row.name,
      prerequisite: formatPrerequisites(row.prerequisites),
      entries: (row.data as { entries?: unknown[] }).entries,
      sourceId: row.sourceId,
      sourceName: row.sourceName,
    };
  }

  return index;
}
