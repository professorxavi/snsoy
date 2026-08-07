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

/**
 * Spell list and detail queries.
 *
 * Filtering and sorting run on the **typed columns**, which are indexed for
 * exactly that. Display values come from the original `data` object alongside
 * them, because the typed columns are lossy by design — see the note in
 * `@/lib/content/spells`. Selecting both is what lets a Range filter be fast
 * and a Range cell be correct at the same time.
 *
 * No `is_srd` condition anywhere, on purpose: the public build is a separate
 * seed containing only SRD rows, so there is nothing to gate at runtime.
 * Source-level access control arrives whole in Phase 6.
 */

export const SPELLS_PER_PAGE = 60;

export interface SpellFilters {
  /** Spell levels, 0 = cantrip. */
  levels?: number[];
  /** Single-letter school codes. */
  schools?: string[];
  /** Casting time units: "action", "bonus", "reaction", "minute", "hour". */
  castingTimes?: string[];
  /** Lowercase class names, matched against the corpus's own mapping. */
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

/** The display shapes, pulled out of the untouched corpus object. */
const displayColumns = {
  time: sql<SpellTime[] | null>`${spells.data}->'time'`,
  range: sql<SpellRange | null>`${spells.data}->'range'`,
  components: sql<SpellComponents | null>`${spells.data}->'components'`,
  duration: sql<SpellDuration[] | null>`${spells.data}->'duration'`,
};

function buildWhere(f: SpellFilters): SQL | undefined {
  const clauses: (SQL | undefined)[] = [];

  if (f.levels?.length) clauses.push(inArray(spells.level, f.levels));
  if (f.schools?.length) clauses.push(inArray(spells.school, f.schools));
  if (f.castingTimes?.length)
    clauses.push(inArray(spells.castingTimeUnit, f.castingTimes));
  if (f.sources?.length) clauses.push(inArray(entities.sourceId, f.sources));
  if (f.classes?.length) clauses.push(arrayOverlaps(spells.classes, f.classes));
  if (f.concentration != null)
    clauses.push(eq(spells.isConcentration, f.concentration));
  if (f.ritual != null) clauses.push(eq(spells.isRitual, f.ritual));
  if (f.q?.trim()) clauses.push(ilike(entities.name, `%${f.q.trim()}%`));

  const present = clauses.filter((c): c is SQL => c != null);
  return present.length > 0 ? and(...present) : undefined;
}

export type SpellRow = Awaited<ReturnType<typeof listSpells>>["rows"][number];

/** One page of spells, plus the unpaginated total the pager needs. */
export async function listSpells(params: SpellListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const perPage = params.perPage ?? SPELLS_PER_PAGE;
  const where = buildWhere(params);

  // Level ties break by name; without it, paging through a level is unstable.
  const orderBy =
    params.sort === "level"
      ? [asc(spells.level), asc(entities.name)]
      : [asc(entities.name)];

  const rowsPromise = db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      page: entities.page,
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

  const totalPromise = db
    .select({ value: count() })
    .from(spells)
    .innerJoin(entities, eq(entities.id, spells.entityId))
    .where(where);

  const [rows, total] = await Promise.all([rowsPromise, totalPromise]);
  const value = total[0]?.value ?? 0;

  return {
    rows,
    total: value,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(value / perPage)),
  };
}

export type SpellDetail = NonNullable<Awaited<ReturnType<typeof getSpell>>>;

/**
 * A single spell, addressed the way the route map addresses it — by source and
 * slug, which is unique together with the entity type.
 */
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
    // Source ids are mixed case in the corpus ("TftYP-ToH") but lowercase in
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

/**
 * Counts per facet value for the filter rail.
 *
 * Each facet is counted against the *other* filters but not its own, so ticking
 * "Evocation" does not zero out every other school in the list. Without that,
 * a filter rail can only ever narrow — you could never see what else is there.
 */
export async function spellFacets(filters: SpellFilters = {}) {
  const facet = async <T extends string | number>(
    column:
      | typeof spells.level
      | typeof spells.school
      | typeof spells.castingTimeUnit,
    exclude: keyof SpellFilters,
  ) => {
    const rest = { ...filters, [exclude]: undefined };
    const rows = await db
      .select({ value: column, n: count() })
      .from(spells)
      .innerJoin(entities, eq(entities.id, spells.entityId))
      .where(buildWhere(rest))
      .groupBy(column);
    return rows as { value: T; n: number }[];
  };

  const classesFacet = async () => {
    const rest = { ...filters, classes: undefined };
    const rows = await db
      .select({
        value: sql<string>`unnested.class_name`,
        n: count(),
      })
      .from(spells)
      .innerJoin(entities, eq(entities.id, spells.entityId))
      .innerJoin(
        sql`LATERAL unnest(${spells.classes}) AS unnested(class_name)`,
        sql`true`,
      )
      .where(buildWhere(rest))
      .groupBy(sql`unnested.class_name`);
    return rows;
  };

  const [levels, schools, castingTimes, classes] = await Promise.all([
    facet<number>(spells.level, "levels"),
    facet<string>(spells.school, "schools"),
    facet<string>(spells.castingTimeUnit, "castingTimes"),
    classesFacet(),
  ]);

  return { levels, schools, castingTimes, classes };
}
