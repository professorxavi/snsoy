import { and, arrayOverlaps, asc, eq, ilike, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "../client";
import { feats } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";
import { abilityName } from "@/lib/content/dnd";
import { flagOption, toOptions, type FacetOption } from "./facets";

/**
 * Feat list and detail queries.
 *
 * Two facets, and both answer a question a player asks out loud at the table.
 * "Which feats raise my Dexterity" is `ability_increase_options`, a `text[]`
 * ingest lifted out of the blob; "which of these can I take right now" is the
 * prerequisite, and the useful half of that is the 46 of 105 feats that have
 * none at all. The rest of a prerequisite is prose — see `featPrerequisite` —
 * and no facet would carry it without lying about the alternatives.
 */

/** The six, in the order every character sheet prints them. */
export const ABILITY_CODES = ["str", "dex", "con", "int", "wis", "cha"];

export interface FeatFilters {
  /** Ability abbreviations: "str", "dex". */
  abilities?: string[];
  /** Only feats anyone can take. */
  open?: boolean;
  /** Name search. Substring, case-insensitive. */
  q?: string;
}

export interface FeatFacetOptions {
  abilities: FacetOption<string>[];
  open: FacetOption<"open">;
}

function buildWhere(f: FeatFilters, skip?: keyof FeatFilters): SQL | undefined {
  const clauses: SQL[] = [];

  if (skip !== "abilities" && f.abilities?.length)
    clauses.push(arrayOverlaps(feats.abilityIncreaseOptions, f.abilities));
  if (skip !== "open" && f.open) clauses.push(isNull(feats.prerequisites));
  if (skip !== "q" && f.q?.trim())
    clauses.push(ilike(entities.name, `%${f.q.trim()}%`));

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export type FeatRow = Awaited<ReturnType<typeof listFeats>>[number];

export async function listFeats(filters: FeatFilters = {}) {
  return db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      prerequisites: feats.prerequisites,
      abilities: feats.abilityIncreaseOptions,
    })
    .from(feats)
    .innerJoin(entities, eq(entities.id, feats.entityId))
    .where(buildWhere(filters))
    .orderBy(asc(entities.name), asc(entities.sourceId));
}

export async function featFacets(
  filters: FeatFilters = {},
): Promise<FeatFacetOptions> {
  const value = sql<string>`unnested.value`;
  const abilityWhere = buildWhere(filters, "abilities");
  const openWhere = buildWhere(filters, "open");

  /*
   * A feat offering a choice of any ability carries all six, so its row is
   * exploded before grouping — the same reason the creature sizes are.
   */
  const abilityRows = db
    .select({
      value,
      n: sql<number>`count(*) FILTER (WHERE ${abilityWhere ?? sql`true`})`,
    })
    .from(feats)
    .innerJoin(entities, eq(entities.id, feats.entityId))
    .innerJoin(
      sql`LATERAL unnest(${feats.abilityIncreaseOptions}) AS unnested(value)`,
      sql`true`,
    )
    .groupBy(value);

  const openRows = db
    .select({
      n: sql<number>`count(*) FILTER (WHERE ${feats.prerequisites} IS NULL${
        openWhere ? sql` AND ${openWhere}` : sql``
      })`,
    })
    .from(feats)
    .innerJoin(entities, eq(entities.id, feats.entityId));

  const [abilities, open] = await Promise.all([abilityRows, openRows]);

  return {
    abilities: toOptions(
      abilities.map((row) => ({ value: row.value, n: Number(row.n) })),
      filters.abilities ?? [],
      (a, b) => ABILITY_CODES.indexOf(a) - ABILITY_CODES.indexOf(b),
      abilityName,
    ),
    open: flagOption("open", Number(open[0]?.n ?? 0), filters.open === true),
  };
}

/** One feat for the aside. */
export async function getFeat(sourceId: string, slug: string) {
  const [row] = await db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      page: entities.page,
      sourceName: sources.name,
      prerequisites: feats.prerequisites,
      data: feats.data,
    })
    .from(feats)
    .innerJoin(entities, eq(entities.id, feats.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(and(ilike(entities.sourceId, sourceId), eq(entities.slug, slug)))
    .limit(1);

  return row ?? null;
}
