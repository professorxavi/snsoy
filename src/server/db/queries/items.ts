import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { cache } from "react";
import {
  bareCode,
  itemTypeName,
  RARITY_ORDER,
  rarityRank,
  resolveItemEntries,
} from "@/lib/content/items";
import { db } from "../client";
import { items } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";
import { supportData } from "../schema/support";
import { flagOption, toOptions, type FacetOption } from "./facets";

/**
 * Item list and detail queries.
 *
 * **One list over two of the three entity types.** `item`, `baseitem` and
 * `itemGroup` all live in the `items` table and all arrive under a single
 * `{@item}` tag, and someone looking for a longsword has no idea that the
 * mundane one is a `baseitem` and the +1 is an `item` — so the list blends
 * those two. The URL scheme is untouched by that: each row still links to its
 * own segment, and the blend happens here in the query, which is the one place
 * the route map allows it.
 *
 * `itemGroup` is read but not browsed. A group is a heading over items that
 * exist in their own right, so listing the 73 of them beside their own members
 * is a row for something nobody is looking for. They still open in the aside
 * from the 66 groups book text cites — which is the difference `ITEM_TYPES` and
 * `BROWSED_ITEM_TYPES` carry between them.
 *
 * The typed columns are for filtering and are lossy in the usual way, so
 * display values come out of `data`. One column is worse than lossy:
 * `item_type_name` was projected by the schema and never populated by ingest,
 * so the human-readable type is resolved from the corpus's own `itemType`
 * support data instead — see `itemVocabulary`.
 */

export const ITEMS_PER_PAGE = 50;

/**
 * Every type the `items` table holds. What `getItem` and the aside address,
 * which is why `itemGroup` is here. Order decides nothing; membership does.
 */
export const ITEM_TYPES = ["item", "baseitem", "itemGroup"] as const;

export type ItemEntityType = (typeof ITEM_TYPES)[number];

/**
 * The types the browse list covers, which is a narrower question — see the
 * module comment. Everything scoping the list, the facets and the flag counts
 * reads this; everything addressing a single entity reads `ITEM_TYPES`.
 */
export const BROWSED_ITEM_TYPES = ["item", "baseitem"] as const;

export type ItemCategory = (typeof BROWSED_ITEM_TYPES)[number];

export interface ItemFilters {
  /** "rare", "very rare", "none" — as stored, not as labelled. */
  rarities?: string[];
  /** Type abbreviations, including the synthetic `WON`, `STF` and `PSN`. */
  types?: string[];
  /** Which side of the list: magic items or equipment. */
  categories?: ItemCategory[];
  sources?: string[];
  attunement?: boolean;
  magic?: boolean;
  /** Name search. Substring, case-insensitive. */
  q?: string;
}

export type ItemSort = "name" | "rarity" | "value";

export interface ItemListParams extends ItemFilters {
  page?: number;
  perPage?: number;
  sort?: ItemSort;
}

/**
 * The type an item is filtered and grouped by.
 *
 * `item_type` covers 2,935 of the 3,645 rows. The rest are typed only by a
 * flag — 776 are wondrous, 29 are staffs the corpus gives no type at all, and
 * 21 are poisons — and without this they would group under NULL, which
 * `toOptions` drops, leaving a fifth of the corpus unreachable from the rail.
 * The three synthetic codes are ours and are named in `lib/content/items`.
 */
const TYPE_CODE = sql<string | null>`
  coalesce(
    ${items.itemType},
    case
      when ${items.isWondrous} then 'WON'
      when (${items.data}->>'staff')::boolean then 'STF'
      when (${items.data}->>'poison')::boolean then 'PSN'
    end
  )
`;

/** Rarity as a position on the scale, so a sort by it runs weakest first. */
const RARITY_RANK = sql<number>`
  coalesce(
    array_position(
      ARRAY[${sql.join(
        RARITY_ORDER.map((rarity) => sql`${rarity}`),
        sql`, `,
      )}]::text[],
      ${items.rarity}
    ),
    ${RARITY_ORDER.length + 1}
  )
`;

/**
 * Filter clauses, optionally omitting one group. `skip` is for facet counting,
 * where a facet is counted against the other filters but not its own.
 */
function buildWhere(f: ItemFilters, skip?: keyof ItemFilters): SQL | undefined {
  const clauses: (SQL | undefined)[] = [
    // Not a filter: these two types are the whole of what this list covers.
    // The join is on `items`, whose rows are those two plus the groups, and the
    // groups are read one at a time rather than browsed.
    inArray(entities.entityType, [...BROWSED_ITEM_TYPES]),
  ];

  if (skip !== "rarities" && f.rarities?.length)
    clauses.push(inArray(items.rarity, f.rarities));
  if (skip !== "types" && f.types?.length)
    clauses.push(inArray(TYPE_CODE, f.types));
  if (skip !== "categories" && f.categories?.length)
    clauses.push(inArray(entities.entityType, f.categories));
  if (skip !== "sources" && f.sources?.length)
    clauses.push(inArray(entities.sourceId, f.sources));
  if (skip !== "attunement" && f.attunement != null)
    clauses.push(eq(items.requiresAttunement, f.attunement));
  if (skip !== "magic" && f.magic != null) clauses.push(eq(items.isMagic, f.magic));
  if (skip !== "q" && f.q?.trim())
    clauses.push(ilike(entities.name, `%${f.q.trim()}%`));

  const present = clauses.filter((c): c is SQL => c != null);
  return present.length > 0 ? and(...present) : undefined;
}

export type ItemRow = Awaited<ReturnType<typeof listItems>>["rows"][number];

/** One page of items, plus the unpaginated total the pager needs. */
export async function listItems(params: ItemListParams = {}) {
  const perPage = params.perPage ?? ITEMS_PER_PAGE;
  const where = buildWhere(params);

  // Count first, not in parallel: the offset depends on the clamped page, and
  // clamping needs the total.
  const [total] = await db
    .select({ value: count() })
    .from(items)
    .innerJoin(entities, eq(entities.id, items.entityId))
    .where(where);

  const matched = total?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(matched / perPage));
  const page = Math.min(Math.max(1, params.page ?? 1), pageCount);

  /*
   * Both alternative sorts break ties by name. Rarity has ten values across
   * 3,645 rows and value has long runs of equal prices — without the tie-break,
   * paging through either reorders rows between requests.
   *
   * Value sorts nulls last: 1,562 items record no price, and an unpriced item
   * is not a free one.
   */
  const orderBy =
    params.sort === "rarity"
      ? [RARITY_RANK, asc(entities.name)]
      : params.sort === "value"
        ? [sql`${items.valueCp} ASC NULLS LAST`, asc(entities.name)]
        : [asc(entities.name)];

  const rows = await db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      entityType: entities.entityType,
      typeCode: TYPE_CODE,
      rarity: items.rarity,
      requiresAttunement: items.requiresAttunement,
      isMagic: items.isMagic,
      valueCp: items.valueCp,
      weightLb: items.weightLb,
    })
    .from(items)
    .innerJoin(entities, eq(entities.id, items.entityId))
    .where(where)
    .orderBy(...orderBy)
    .limit(perPage)
    .offset((page - 1) * perPage);

  // Resolved here rather than in the table, so nothing downstream has to carry
  // the vocabulary around to print a column.
  const { types } = await itemVocabulary();

  return {
    rows: rows.map((row) => ({
      ...row,
      entityType: row.entityType as ItemEntityType,
      typeName: itemTypeName(row.typeCode, types),
    })),
    total: matched,
    page,
    perPage,
    pageCount,
  };
}

export type ItemDetail = NonNullable<Awaited<ReturnType<typeof getItem>>>;

/**
 * One item by type, source and slug — unique together, which is what lets three
 * entity types share this table without a URL collision. The type is required
 * rather than searched for: DMG `potion-of-healing` is both an `item` and an
 * `itemGroup`, the one measured collision in the whole family.
 */
export async function getItem(
  entityType: ItemEntityType,
  sourceId: string,
  slug: string,
) {
  const [row] = await db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      entityType: entities.entityType,
      page: entities.page,
      sourceName: sources.name,
      typeCode: TYPE_CODE,
      rarity: items.rarity,
      itemType: items.itemType,
      requiresAttunement: items.requiresAttunement,
      valueCp: items.valueCp,
      weightLb: items.weightLb,
      armorClass: items.armorClass,
      properties: items.properties,
      data: items.data,
    })
    .from(items)
    .innerJoin(entities, eq(entities.id, items.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    // Source ids are mixed case in the data ("TftYP-ToH") but lowercase in
    // URLs, so match case-insensitively rather than forcing the caller to know.
    .where(
      and(
        eq(entities.entityType, entityType),
        ilike(entities.sourceId, sourceId),
        eq(entities.slug, slug),
      ),
    )
    .limit(1);

  if (!row) return null;

  const [{ types }, templates] = await Promise.all([
    itemVocabulary(),
    itemEntryTemplates(),
  ]);

  /*
   * Spliced here rather than in the panel, so that everything downstream sees
   * prose — `collectReferences`, the renderer and `ItemDetail`'s own
   * `applyBaseName` pass alike. See `resolveItemEntries`.
   */
  const data: Record<string, unknown> = {
    ...row.data,
    entries: resolveItemEntries(row.data["entries"], row.data, templates),
  };

  return {
    ...row,
    data,
    entityType: row.entityType as ItemEntityType,
    typeName: itemTypeName(row.typeCode, types),
  };
}

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

export interface ItemVocabulary {
  /** Type abbreviation to name: `HA` → "Heavy Armor". */
  types: ReadonlyMap<string, string>;
  /** Property abbreviation to name: `V` → "Versatile". */
  properties: ReadonlyMap<string, string>;
}

/**
 * The corpus's own names for the codes items are stored with.
 *
 * Read from `support_data` rather than transcribed into a constant: these 48
 * rows were ingested from the same files as the items that cite them, and a
 * second copy in the repository would be a second thing to keep in step with a
 * re-ingest. Cached per request, because every list row and every open item
 * needs the same two maps.
 *
 * A property's display name is usually the name of its first entry — the rules
 * text that defines it — and only "special" carries a top-level `name`.
 */
export const itemVocabulary = cache(async (): Promise<ItemVocabulary> => {
  const rows = await db
    .select({
      kind: supportData.kind,
      key: supportData.key,
      name: sql<
        string | null
      >`coalesce(${supportData.data}->'entries'->0->>'name', ${supportData.data}->>'name')`,
    })
    .from(supportData)
    .where(inArray(supportData.kind, ["itemType", "itemProperty"]));

  const types = new Map<string, string>();
  const properties = new Map<string, string>();

  for (const row of rows) {
    if (!row.name) continue;
    // Keys carry the source they were defined in for a few properties, and the
    // items citing them do too — both sides are reduced to the bare code.
    const target = row.kind === "itemType" ? types : properties;
    target.set(bareCode(row.key), row.name);
  }

  return { types, properties };
});

/**
 * The descriptions many items share, keyed as `name|source`.
 *
 * Six rows, cited by 170 items. The corpus writes a description that applies to
 * a whole family once — every Armor of Resistance says the same sentence — and
 * each member carries a `{#itemEntry}` citation where the paragraph belongs.
 * Nothing read this kind of `support_data` until now, so all 170 printed the
 * citation; see `resolveItemEntries`.
 *
 * Cached per request like the vocabulary, and for the same reason: every open
 * item asks for the same six rows.
 */
export const itemEntryTemplates = cache(
  async (): Promise<ReadonlyMap<string, unknown[]>> => {
    const rows = await db
      .select({
        key: supportData.key,
        template: sql<unknown[] | null>`${supportData.data}->'entriesTemplate'`,
      })
      .from(supportData)
      .where(eq(supportData.kind, "itemEntry"));

    const templates = new Map<string, unknown[]>();
    for (const row of rows) {
      if (Array.isArray(row.template)) templates.set(row.key.toLowerCase(), row.template);
    }

    return templates;
  },
);

/* ------------------------------------------------------------------ *
 * Facets
 * ------------------------------------------------------------------ */

export interface ItemFacetOptions {
  rarities: FacetOption<string>[];
  types: FacetOption<string>[];
  categories: FacetOption<ItemCategory>[];
  attunement: FacetOption<"attunement">;
  magic: FacetOption<"magic">;
}

/**
 * One row per facet value, with the number of items it would leave.
 *
 * The GROUP BY runs over every item so the result is the full domain, while the
 * count is a FILTER against the *other* filters. That way options never appear
 * or disappear as you filter, they only become unavailable.
 */
async function facetCounts(
  column: SQL | typeof items.rarity | typeof entities.entityType,
  filters: ItemFilters,
  skip: keyof ItemFilters,
): Promise<{ value: string; n: number }[]> {
  const where = buildWhere(filters, skip);
  const scope = inArray(entities.entityType, [...BROWSED_ITEM_TYPES]);

  const rows = await db
    .select({
      value: column as SQL<string>,
      n: sql<number>`count(*) FILTER (WHERE ${where ?? sql`true`})`,
    })
    .from(items)
    .innerJoin(entities, eq(entities.id, items.entityId))
    .where(scope)
    .groupBy(column as SQL);

  // Postgres returns bigint counts as strings through the driver.
  return rows.map((row) => ({ value: row.value, n: Number(row.n) }));
}

/** Player-facing names for the two entity types the list blends. */
const CATEGORY_LABELS: Record<ItemCategory, string> = {
  item: "Magic items",
  baseitem: "Equipment",
};

/** Every filter option, with the counts the rail shows beside them. */
export async function itemFacets(
  filters: ItemFilters = {},
): Promise<ItemFacetOptions> {
  /** A boolean facet is the count of items that have it. */
  const flagCount = async (
    column: typeof items.requiresAttunement | typeof items.isMagic,
    skip: keyof ItemFilters,
  ) => {
    const where = buildWhere(filters, skip);
    const [row] = await db
      .select({
        n: sql<number>`count(*) FILTER (WHERE ${column}${where ? sql` AND ${where}` : sql``})`,
      })
      .from(items)
      .innerJoin(entities, eq(entities.id, items.entityId))
      .where(inArray(entities.entityType, [...BROWSED_ITEM_TYPES]));
    return Number(row?.n ?? 0);
  };

  const [rarities, types, categories, attuneCount, magicCount, vocabulary] =
    await Promise.all([
      facetCounts(items.rarity, filters, "rarities"),
      facetCounts(TYPE_CODE, filters, "types"),
      facetCounts(entities.entityType, filters, "categories"),
      flagCount(items.requiresAttunement, "attunement"),
      flagCount(items.isMagic, "magic"),
      itemVocabulary(),
    ]);

  const nameFor = (code: string) => itemTypeName(code, vocabulary.types) ?? code;

  return {
    // By power, not alphabetically — see `rarityRank`.
    rarities: toOptions(
      rarities,
      filters.rarities ?? [],
      (a, b) => rarityRank(a) - rarityRank(b),
    ),
    // Sorted and labelled by the resolved name: the value in the URL stays the
    // abbreviation, so a filtered link survives a change of wording.
    types: toOptions(
      types,
      filters.types ?? [],
      (a, b) => nameFor(a).localeCompare(nameFor(b)),
      nameFor,
    ),
    categories: toOptions(
      categories as { value: ItemCategory; n: number }[],
      filters.categories ?? [],
      (a, b) => BROWSED_ITEM_TYPES.indexOf(a) - BROWSED_ITEM_TYPES.indexOf(b),
      (value) => CATEGORY_LABELS[value],
    ),
    attunement: flagOption("attunement", attuneCount, filters.attunement === true),
    magic: flagOption("magic", magicCount, filters.magic === true),
  };
}
