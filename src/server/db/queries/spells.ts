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
 * Filtering, sorting and paging all run in the database. Spells are small
 * enough to have been sent to the client whole, and were for a while — but
 * every other compendium type is not (monsters 3,808, items 3,501), and one
 * browsing model across all of them is worth more than spells alone being
 * instant. This is the shape those slices will reuse.
 *
 * Filtering runs on the **typed columns**, which are indexed for exactly that.
 * Display values come from the original `data` object alongside them, because
 * the typed columns are lossy by design — see the note in
 * `@/lib/content/spells`. Selecting both is what lets a Range filter be fast
 * and a Range cell be correct at the same time.
 *
 * No `is_srd` condition anywhere, on purpose: the public build is a separate
 * seed containing only SRD rows, so there is nothing to gate at runtime.
 * Source-level access control arrives whole in Phase 6.
 */

export const SPELLS_PER_PAGE = 50;

export interface SpellFilters {
  /** Spell levels, 0 = cantrip. */
  levels?: number[];
  /** Single-letter school codes. */
  schools?: string[];
  /** Casting time units: "action", "bonus", "reaction", "minute", "hour". */
  castingTimes?: string[];
  /** Class names as stored — Title-cased, e.g. "Cleric". */
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

/**
 * Filter clauses, optionally omitting one group.
 *
 * `skip` exists for facet counting: a facet must be counted against every
 * *other* filter but not its own, or selecting "Evocation" would zero out every
 * other school and you could never switch.
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
   * The count runs first, and the two are deliberately not parallelised.
   *
   * The offset cannot be computed until the page number has been clamped, and
   * the page number cannot be clamped without knowing how many pages there
   * are. Running them together and clamping only the *reported* page is the
   * subtle version of this bug: `?page=999` then returns a sensible-looking
   * "page 11 of 11" with an empty table under it, because the offset was built
   * from 999. One extra round trip on an indexed count is worth not doing that.
   */
  const [total] = await db
    .select({ value: count() })
    .from(spells)
    .innerJoin(entities, eq(entities.id, spells.entityId))
    .where(where);

  const matched = total?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(matched / perPage));
  const page = Math.min(Math.max(1, params.page ?? 1), pageCount);

  // Level ties break by name; without it, paging through a level is unstable
  // and a row can appear on two pages or none.
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

/* ------------------------------------------------------------------ *
 * Facets
 * ------------------------------------------------------------------ */

export interface FacetOption<T> {
  value: T;
  /** How many spells this option would leave, given the *other* filters. */
  count: number;
  selected: boolean;
  /** Nothing to show. Kept visible and inert rather than removed. */
  disabled: boolean;
}

export interface SpellFacetOptions {
  levels: FacetOption<number>[];
  schools: FacetOption<string>[];
  castingTimes: FacetOption<string>[];
  classes: FacetOption<string>[];
  concentration: FacetOption<"conc">;
  ritual: FacetOption<"ritual">;
}

/**
 * One row per facet value: the value, and how many spells it would leave.
 *
 * The `GROUP BY` runs over **every** spell, so the result is the full domain —
 * every level, school, casting time and class the corpus contains — while the
 * count is a `FILTER` against the other filters. That combination is the whole
 * point: options never appear or disappear as you filter, they only become
 * unavailable. A rail whose contents rearrange cannot be learned, and a
 * vanished option is indistinguishable from one that never existed.
 *
 * Doing it as one grouped pass rather than a domain query plus a counts query
 * also keeps it to a single round trip per facet.
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

function toOptions<T extends string | number>(
  rows: { value: T; n: number }[],
  selected: readonly T[],
  order: (a: T, b: T) => number,
): FacetOption<T>[] {
  return rows
    .filter((row) => row.value != null)
    .sort((a, b) => order(a.value, b.value))
    .map((row) => {
      const isSelected = selected.includes(row.value);
      return {
        value: row.value,
        count: row.n,
        selected: isSelected,
        // A selected option stays clickable even at zero, or a filter that
        // narrows to nothing could never be undone from the rail.
        disabled: row.n === 0 && !isSelected,
      };
    });
}

/** Action economy order, not alphabetical — "action" before "bonus". */
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

  /** A boolean facet has a domain of one: the count of spells that have it. */
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

  const flag = <T extends string>(
    value: T,
    n: number,
    selected: boolean,
  ): FacetOption<T> => ({
    value,
    count: n,
    selected,
    disabled: n === 0 && !selected,
  });

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
