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
import { db } from "../client";
import { monsters } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";
import { supportData } from "../schema/support";
import { flagOption, toOptions, type FacetOption } from "./facets";

/**
 * Monster list and detail queries.
 *
 * The largest content type by some way — 3,628 creatures against 525 spells —
 * so this is the first list where paging and database-side filtering are load
 * bearing rather than a rehearsal for later. It follows the shape the spell
 * queries set: filters on the indexed typed columns, display values out of the
 * raw `data`.
 *
 * The typed columns are lossy and exist for filtering only. `armor_class` holds
 * 13 for a creature printed as "13, 16 with mage armor", and `cr` is a number
 * so ranges sort — which is why the list prints `cr_display` beside it. See the
 * note at the top of `@/lib/content/monsters`.
 *
 * No `is_srd` condition: the public build uses an SRD-only seed, so there is
 * nothing to gate at runtime.
 */

export const MONSTERS_PER_PAGE = 50;

export interface MonsterFilters {
  /** Challenge ratings as printed — "1/4", "17" — not the sortable number. */
  crs?: string[];
  /** "dragon", "humanoid", "undead"… */
  types?: string[];
  /** Single-letter size codes: T, S, M, L, H, G. */
  sizes?: string[];
  environments?: string[];
  sources?: string[];
  legendary?: boolean;
  spellcaster?: boolean;
  /** Name search. Substring, case-insensitive. */
  q?: string;
}

export type MonsterSort = "name" | "cr";

export interface MonsterListParams extends MonsterFilters {
  page?: number;
  perPage?: number;
  sort?: MonsterSort;
}

/**
 * Filter clauses, optionally omitting one group. `skip` is for facet counting,
 * where a facet is counted against the other filters but not its own.
 */
function buildWhere(
  f: MonsterFilters,
  skip?: keyof MonsterFilters,
): SQL | undefined {
  const clauses: (SQL | undefined)[] = [];

  if (skip !== "crs" && f.crs?.length)
    clauses.push(inArray(monsters.crDisplay, f.crs));
  if (skip !== "types" && f.types?.length)
    clauses.push(inArray(monsters.creatureType, f.types));
  // Array columns: a creature that is Small or Medium matches either.
  if (skip !== "sizes" && f.sizes?.length)
    clauses.push(arrayOverlaps(monsters.sizes, f.sizes));
  if (skip !== "environments" && f.environments?.length)
    clauses.push(arrayOverlaps(monsters.environments, f.environments));
  if (skip !== "sources" && f.sources?.length)
    clauses.push(inArray(entities.sourceId, f.sources));
  if (skip !== "legendary" && f.legendary != null)
    clauses.push(eq(monsters.isLegendary, f.legendary));
  if (skip !== "spellcaster" && f.spellcaster != null)
    clauses.push(eq(monsters.isSpellcaster, f.spellcaster));
  if (skip !== "q" && f.q?.trim())
    clauses.push(ilike(entities.name, `%${f.q.trim()}%`));

  const present = clauses.filter((c): c is SQL => c != null);
  return present.length > 0 ? and(...present) : undefined;
}

export type MonsterRow = Awaited<ReturnType<typeof listMonsters>>["rows"][number];

/** One page of creatures, plus the unpaginated total the pager needs. */
export async function listMonsters(params: MonsterListParams = {}) {
  const perPage = params.perPage ?? MONSTERS_PER_PAGE;
  const where = buildWhere(params);

  /*
   * Count first, not in parallel: the offset depends on the clamped page, and
   * clamping needs the total. Running them together and clamping only the
   * reported page gives "page 73 of 73" above an empty table for `?page=999`.
   */
  const [total] = await db
    .select({ value: count() })
    .from(monsters)
    .innerJoin(entities, eq(entities.id, monsters.entityId))
    .where(where);

  const matched = total?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(matched / perPage));
  const page = Math.min(Math.max(1, params.page ?? 1), pageCount);

  /*
   * Sorting by CR puts the 84 creatures with no rating last rather than first.
   * Postgres sorts nulls last on an ascending sort by default, but saying so
   * explicitly keeps the intent when someone adds a descending order later.
   * Ties break by name, or paging through a rating is unstable.
   */
  const orderBy =
    params.sort === "cr"
      ? [sql`${monsters.cr} ASC NULLS LAST`, asc(entities.name)]
      : [asc(entities.name)];

  const rows = await db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      cr: monsters.cr,
      crDisplay: monsters.crDisplay,
      creatureType: monsters.creatureType,
      sizes: monsters.sizes,
      armorClass: monsters.armorClass,
      hitPointsAverage: monsters.hitPointsAverage,
      environments: monsters.environments,
      isLegendary: monsters.isLegendary,
      isSpellcaster: monsters.isSpellcaster,
    })
    .from(monsters)
    .innerJoin(entities, eq(entities.id, monsters.entityId))
    .where(where)
    .orderBy(...orderBy)
    .limit(perPage)
    .offset((page - 1) * perPage);

  return { rows, total: matched, page, perPage, pageCount };
}

export type MonsterDetail = NonNullable<Awaited<ReturnType<typeof getMonster>>>;

/** One creature by source and slug, which is unique with the entity type. */
export async function getMonster(sourceId: string, slug: string) {
  const [row] = await db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      page: entities.page,
      sourceName: sources.name,
      /*
       * Kept because the stat block prints them and the columns are cheaper to
       * read than the blob is to parse — but note `cr` is the numeric form for
       * sorting, so the block prints `crDisplay` and falls back to `data.cr`,
       * which is the only one carrying a lair or coven rating.
       */
      crDisplay: monsters.crDisplay,
      isLegendary: monsters.isLegendary,
      data: monsters.data,
      fluff: entities.fluff,
      /*
       * What the creature does in its own lair, which the books print beside
       * the block and this app showed nowhere.
       *
       * Joined on the key the creature names — `aboleth|mm` — and deliberately
       * **not** through `monsters.legendary_group_id`. That column is set on
       * 147 creatures and resolves for none of them: 112 point at the creature
       * itself and the other 35 at a different creature altogether, so
       * Exethanter would show the Lich's block and Mad Maggie the Night Hag's.
       * There is no `legendaryGroup` in the `entity_type` enum for it to have
       * pointed at. Left join, because 3,405 creatures have no lair at all.
       */
      lair: supportData.data,
    })
    .from(monsters)
    .innerJoin(entities, eq(entities.id, monsters.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .leftJoin(
      supportData,
      and(
        eq(supportData.kind, "legendaryGroup"),
        sql`${supportData.key} = lower(${monsters.data}->'legendaryGroup'->>'name')
            || '|' || lower(${monsters.data}->'legendaryGroup'->>'source')`,
      ),
    )
    // Source ids are mixed case in the data ("TftYP-ToH") but lowercase in
    // URLs, so match case-insensitively rather than forcing the caller to know.
    .where(
      and(
        eq(entities.entityType, "monster"),
        ilike(entities.sourceId, sourceId),
        eq(entities.slug, slug),
      ),
    )
    .limit(1);

  // Early return rather than `row ?? null`: the destructured row is not typed
  // optional, so the coalesce collapses away and the signature ends up
  // promising a creature it cannot deliver. Every caller already guards.
  if (!row) return null;

  return row;
}

/* ------------------------------------------------------------------ *
 * Facets
 * ------------------------------------------------------------------ */

export interface MonsterFacetOptions {
  crs: FacetOption<string>[];
  types: FacetOption<string>[];
  sizes: FacetOption<string>[];
  environments: FacetOption<string>[];
  legendary: FacetOption<"legendary">;
  spellcaster: FacetOption<"spellcaster">;
}

/**
 * One row per facet value, with the number of creatures it would leave.
 *
 * The GROUP BY runs over every creature so the result is the full domain, while
 * the count is a FILTER against the *other* filters. That way options never
 * appear or disappear as you filter, they only become unavailable.
 */
async function facetCounts(
  column: SQL | typeof monsters.crDisplay | typeof monsters.creatureType,
  filters: MonsterFilters,
  skip: keyof MonsterFilters,
  /** Ordered by something other than the value itself, where that is wrong. */
  orderKey?: SQL,
): Promise<{ value: string; n: number; order: number }[]> {
  const where = buildWhere(filters, skip);

  const rows = await db
    .select({
      value: column as SQL<string>,
      n: sql<number>`count(*) FILTER (WHERE ${where ?? sql`true`})`,
      order: orderKey ?? sql<number>`0`,
    })
    .from(monsters)
    .innerJoin(entities, eq(entities.id, monsters.entityId))
    .groupBy(column as SQL);

  // Postgres returns bigint counts as strings through the driver.
  return rows.map((row) => ({
    value: row.value,
    n: Number(row.n),
    /*
     * No sort key means the value has no place on the scale, so it goes to the
     * end. The books have exactly one: the creature rated "Unknown", whose
     * `min(cr)` is null — read as a zero it would sort ahead of CR 0 and head
     * the whole rail.
     */
    order: row.order == null ? Number.POSITIVE_INFINITY : Number(row.order),
  }));
}

/**
 * Counts for a text[] column — size and environment.
 *
 * A creature belongs to every value in its array, so the rows are exploded with
 * a LATERAL unnest before grouping. Counting the column directly would group by
 * the whole array instead, making `{forest,hill}` its own facet value.
 */
async function arrayFacetCounts(
  column: typeof monsters.sizes | typeof monsters.environments,
  filters: MonsterFilters,
  skip: keyof MonsterFilters,
): Promise<{ value: string; n: number }[]> {
  const where = buildWhere(filters, skip);
  const value = sql<string>`unnested.value`;

  const rows = await db
    .select({
      value,
      n: sql<number>`count(*) FILTER (WHERE ${where ?? sql`true`})`,
    })
    .from(monsters)
    .innerJoin(entities, eq(entities.id, monsters.entityId))
    .innerJoin(sql`LATERAL unnest(${column}) AS unnested(value)`, sql`true`)
    .groupBy(value);

  return rows.map((row) => ({ value: row.value, n: Number(row.n) }));
}

/** Sizes run smallest to largest, never alphabetically. */
const SIZE_ORDER = ["T", "S", "M", "L", "H", "G"];

/** Every filter option, with the counts the rail shows beside them. */
export async function monsterFacets(
  filters: MonsterFilters = {},
): Promise<MonsterFacetOptions> {
  /** A boolean facet is the count of creatures that have it. */
  const flagCount = async (
    column: typeof monsters.isLegendary | typeof monsters.isSpellcaster,
    skip: keyof MonsterFilters,
  ) => {
    const where = buildWhere(filters, skip);
    const [row] = await db
      .select({
        n: sql<number>`count(*) FILTER (WHERE ${column}${where ? sql` AND ${where}` : sql``})`,
      })
      .from(monsters)
      .innerJoin(entities, eq(entities.id, monsters.entityId));
    return Number(row?.n ?? 0);
  };

  const [crs, types, sizes, environments, legendaryCount, casterCount] =
    await Promise.all([
      // Ordered by the numeric rating, not the printed one — otherwise "10"
      // sorts before "2" and "1/2" lands nowhere near either.
      facetCounts(monsters.crDisplay, filters, "crs", sql<number>`min(${monsters.cr})`),
      facetCounts(monsters.creatureType, filters, "types"),
      arrayFacetCounts(monsters.sizes, filters, "sizes"),
      arrayFacetCounts(monsters.environments, filters, "environments"),
      flagCount(monsters.isLegendary, "legendary"),
      flagCount(monsters.isSpellcaster, "spellcaster"),
    ]);

  /** Keyed by value, so the sort comparator can reach the numeric rating. */
  const crOrder = new Map(crs.map((row) => [row.value, row.order]));
  const byRating = (a: string, b: string) => {
    const left = crOrder.get(a) ?? 0;
    const right = crOrder.get(b) ?? 0;
    // Both unplaceable: fall back to the printed value so the order is stable.
    if (left === right) return a.localeCompare(b);
    return left - right;
  };

  return {
    crs: toOptions(crs, filters.crs ?? [], byRating),
    types: toOptions(types, filters.types ?? [], (a, b) => a.localeCompare(b)),
    sizes: toOptions(
      sizes,
      filters.sizes ?? [],
      (a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b),
    ),
    environments: toOptions(environments, filters.environments ?? [], (a, b) =>
      a.localeCompare(b),
    ),
    legendary: flagOption("legendary", legendaryCount, filters.legendary === true),
    spellcaster: flagOption(
      "spellcaster",
      casterCount,
      filters.spellcaster === true,
    ),
  };
}
