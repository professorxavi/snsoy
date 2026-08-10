import {
  and,
  arrayOverlaps,
  asc,
  count,
  eq,
  ilike,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import type {
  SpellComponents,
  SpellDuration,
  SpellRange,
  SpellTime,
} from "@/lib/content/spells";
import { db } from "../client";
import { spells } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";
import { flagOption, toOptions, type FacetOption } from "./facets";

export type { FacetOption };

/**
 * Spell list and detail queries. Filtering, sorting and paging run in the
 * database; other compendium types are far larger, so this is the shape they
 * will reuse.
 *
 * Filters use the indexed typed columns. Display values come from the raw
 * `data` object, because the typed columns are lossy (see `@/lib/content/spells`).
 *
 * No `is_srd` condition: the public build uses an SRD-only seed, so there is
 * nothing to gate at runtime.
 */

export const SPELLS_PER_PAGE = 50;

export interface SpellFilters {
  /** Spell levels, 0 = cantrip. */
  levels?: number[];
  /** Single-letter school codes. */
  schools?: string[];
  /** Casting time units: "action", "bonus", "reaction", "minute", "hour". */
  castingTimes?: string[];
  /** Class names as stored, Title-cased. */
  classes?: string[];
  sources?: string[];
  concentration?: boolean;
  ritual?: boolean;
  /** Name search. Substring, case-insensitive. */
  q?: string;
}

export type SpellSort = "name" | "level";

export interface SpellListParams extends SpellFilters {
  page?: number;
  perPage?: number;
  sort?: SpellSort;
}

/** Display values, read straight out of the stored JSON. */
const displayColumns = {
  time: sql<SpellTime[] | null>`${spells.data}->'time'`,
  range: sql<SpellRange | null>`${spells.data}->'range'`,
  components: sql<SpellComponents | null>`${spells.data}->'components'`,
  duration: sql<SpellDuration[] | null>`${spells.data}->'duration'`,
};

/**
 * Filter clauses, optionally omitting one group. `skip` is for facet counting,
 * where a facet is counted against the other filters but not its own.
 */
function buildWhere(
  f: SpellFilters,
  skip?: keyof SpellFilters,
): SQL | undefined {
  const clauses: (SQL | undefined)[] = [];

  if (skip !== "levels" && f.levels?.length)
    clauses.push(inArray(spells.level, f.levels));
  if (skip !== "schools" && f.schools?.length)
    clauses.push(inArray(spells.school, f.schools));
  if (skip !== "castingTimes" && f.castingTimes?.length)
    clauses.push(inArray(spells.castingTimeUnit, f.castingTimes));
  if (skip !== "sources" && f.sources?.length)
    clauses.push(inArray(entities.sourceId, f.sources));
  if (skip !== "classes" && f.classes?.length)
    clauses.push(arrayOverlaps(spells.classes, f.classes));
  if (skip !== "concentration" && f.concentration != null)
    clauses.push(eq(spells.isConcentration, f.concentration));
  if (skip !== "ritual" && f.ritual != null)
    clauses.push(eq(spells.isRitual, f.ritual));
  if (skip !== "q" && f.q?.trim())
    clauses.push(ilike(entities.name, `%${f.q.trim()}%`));

  const present = clauses.filter((c): c is SQL => c != null);
  return present.length > 0 ? and(...present) : undefined;
}

export type SpellRow = Awaited<ReturnType<typeof listSpells>>["rows"][number];

/** One page of spells, plus the unpaginated total the pager needs. */
export async function listSpells(params: SpellListParams = {}) {
  const perPage = params.perPage ?? SPELLS_PER_PAGE;
  const where = buildWhere(params);

  /*
   * Count first, not in parallel: the offset depends on the clamped page, and
   * clamping needs the total. Running them together and clamping only the
   * reported page gives "page 11 of 11" above an empty table for `?page=999`.
   */
  const [total] = await db
    .select({ value: count() })
    .from(spells)
    .innerJoin(entities, eq(entities.id, spells.entityId))
    .where(where);

  const matched = total?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(matched / perPage));
  const page = Math.min(Math.max(1, params.page ?? 1), pageCount);

  // Level ties break by name, or paging through a level is unstable.
  const orderBy =
    params.sort === "level"
      ? [asc(spells.level), asc(entities.name)]
      : [asc(entities.name)];

  const rows = await db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      level: spells.level,
      school: spells.school,
      isConcentration: spells.isConcentration,
      isRitual: spells.isRitual,
      classes: spells.classes,
      ...displayColumns,
    })
    .from(spells)
    .innerJoin(entities, eq(entities.id, spells.entityId))
    .where(where)
    .orderBy(...orderBy)
    .limit(perPage)
    .offset((page - 1) * perPage);

  return { rows, total: matched, page, perPage, pageCount };
}

export type SpellDetail = NonNullable<Awaited<ReturnType<typeof getSpell>>>;

/** A single spell by source and slug, which is unique with the entity type. */
export async function getSpell(sourceId: string, slug: string) {
  const [row] = await db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      page: entities.page,
      isSrd: entities.isSrd,
      sourceName: sources.name,
      level: spells.level,
      school: spells.school,
      isConcentration: spells.isConcentration,
      isRitual: spells.isRitual,
      classes: spells.classes,
      subclasses: spells.subclasses,
      data: spells.data,
      ...displayColumns,
    })
    .from(spells)
    .innerJoin(entities, eq(entities.id, spells.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    // Source ids are mixed case in the data ("TftYP-ToH") but lowercase in
    // URLs, so match case-insensitively rather than forcing the caller to know.
    .where(
      and(
        eq(entities.entityType, "spell"),
        ilike(entities.sourceId, sourceId),
        eq(entities.slug, slug),
      ),
    )
    .limit(1);

  return row ?? null;
}

/* ------------------------------------------------------------------ *
 * Facets
 * ------------------------------------------------------------------ */

export interface SpellFacetOptions {
  levels: FacetOption<number>[];
  schools: FacetOption<string>[];
  castingTimes: FacetOption<string>[];
  classes: FacetOption<string>[];
  concentration: FacetOption<"conc">;
  ritual: FacetOption<"ritual">;
}

/**
 * One row per facet value, with the number of spells it would leave.
 *
 * The GROUP BY runs over every spell so the result is the full domain, while
 * the count is a FILTER against the other filters. That way options never
 * appear or disappear as you filter, they only become unavailable.
 */
async function facetCounts<T extends string | number>(
  column: SQL | typeof spells.level | typeof spells.school | typeof spells.castingTimeUnit,
  filters: SpellFilters,
  skip: keyof SpellFilters,
): Promise<{ value: T; n: number }[]> {
  const where = buildWhere(filters, skip);

  const rows = await db
    .select({
      value: column as SQL<T>,
      n: sql<number>`count(*) FILTER (WHERE ${where ?? sql`true`})`,
    })
    .from(spells)
    .innerJoin(entities, eq(entities.id, spells.entityId))
    .groupBy(column as SQL);

  // Postgres returns bigint counts as strings through the driver.
  return rows.map((row) => ({ value: row.value, n: Number(row.n) }));
}

/** Action economy order, not alphabetical. */
const TIME_ORDER = ["action", "bonus", "reaction", "round", "minute", "hour"];

function byTimeOrder(a: string, b: string): number {
  const ai = TIME_ORDER.indexOf(a);
  const bi = TIME_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

/** Every filter option, with the counts the rail shows beside them. */
export async function spellFacets(
  filters: SpellFilters = {},
): Promise<SpellFacetOptions> {
  const className = sql<string>`unnested.class_name`;

  const classCounts = async () => {
    const where = buildWhere(filters, "classes");
    const rows = await db
      .select({
        value: className,
        n: sql<number>`count(*) FILTER (WHERE ${where ?? sql`true`})`,
      })
      .from(spells)
      .innerJoin(entities, eq(entities.id, spells.entityId))
      .innerJoin(
        sql`LATERAL unnest(${spells.classes}) AS unnested(class_name)`,
        sql`true`,
      )
      .groupBy(className);
    return rows.map((row) => ({ value: row.value, n: Number(row.n) }));
  };

  /** A boolean facet has one value: the count of spells that have it. */
  const flagCount = async (
    column: typeof spells.isConcentration | typeof spells.isRitual,
    skip: keyof SpellFilters,
  ) => {
    const where = buildWhere(filters, skip);
    const [row] = await db
      .select({
        n: sql<number>`count(*) FILTER (WHERE ${column}${where ? sql` AND ${where}` : sql``})`,
      })
      .from(spells)
      .innerJoin(entities, eq(entities.id, spells.entityId));
    return Number(row?.n ?? 0);
  };

  const [levels, schools, castingTimes, classes, concCount, ritualCount] =
    await Promise.all([
      facetCounts<number>(spells.level, filters, "levels"),
      facetCounts<string>(spells.school, filters, "schools"),
      facetCounts<string>(spells.castingTimeUnit, filters, "castingTimes"),
      classCounts(),
      flagCount(spells.isConcentration, "concentration"),
      flagCount(spells.isRitual, "ritual"),
    ]);

  const flag = flagOption;

  return {
    levels: toOptions(levels, filters.levels ?? [], (a, b) => a - b),
    schools: toOptions(schools, filters.schools ?? [], (a, b) =>
      a.localeCompare(b),
    ),
    castingTimes: toOptions(
      castingTimes,
      filters.castingTimes ?? [],
      byTimeOrder,
    ),
    classes: toOptions(classes, filters.classes ?? [], (a, b) =>
      a.localeCompare(b),
    ),
    concentration: flag("conc", concCount, filters.concentration === true),
    ritual: flag("ritual", ritualCount, filters.ritual === true),
  };
}
