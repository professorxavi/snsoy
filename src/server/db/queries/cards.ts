import { and, asc, count, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../client";
import { genericEntities } from "../schema/content";
import { entities } from "../schema/entities";
import { toOptions, type FacetOption } from "./facets";

/**
 * The card list and its one facet.
 *
 * A query module rather than `listGeneric` for the same reason the deities have
 * one: 656 rows is five times the largest list that path was written for, so
 * this pages. The facet is the deck — 23 of them — which is the only question a
 * list of 656 cards can usefully answer: nobody browses cards in general, they
 * browse the Tarokka Deck or the Deck of Many Things.
 *
 * The deck is also part of a card's identity, not decoration: five decks deal a
 * Jester, and the `set` field is what tells those five rows apart.
 */

export const CARDS_PER_PAGE = 50;

const TYPE = eq(entities.entityType, "card");

const DECK = sql<string>`${genericEntities.data}->>'set'`;

export interface CardFilters {
  /** Deck names as stored: "Tarokka Deck". */
  decks?: string[];
  /** Name search. Substring, case-insensitive. */
  q?: string;
}

export interface CardFacetOptions {
  decks: FacetOption<string>[];
}

function buildWhere(f: CardFilters, skip?: keyof CardFilters): SQL | undefined {
  const clauses: SQL[] = [];

  // `inArray` rather than `= ANY(…)`: a JS array in a `sql` template is spread
  // into one placeholder per element, which Postgres rejects as an array.
  if (skip !== "decks" && f.decks?.length) clauses.push(inArray(DECK, f.decks));
  if (skip !== "q" && f.q?.trim()) clauses.push(ilike(entities.name, `%${f.q.trim()}%`));

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export type CardRow = Awaited<ReturnType<typeof listCards>>["rows"][number];

/** One page of cards, plus the unpaginated total the pager needs. */
export async function listCards(params: CardFilters & { page?: number } = {}) {
  const where = buildWhere(params);

  // Count first, not in parallel: the offset depends on the clamped page, and
  // clamping needs the total.
  const [total] = await db
    .select({ value: count() })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .where(where ? and(TYPE, where) : TYPE);

  const matched = total?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(matched / CARDS_PER_PAGE));
  const page = Math.min(Math.max(1, params.page ?? 1), pageCount);

  const rows = await db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      deck: DECK,
      suit: sql<string | null>`${genericEntities.data}->>'suit'`,
      value: sql<string | null>`${genericEntities.data}->>'value'`,
      valueName: sql<string | null>`${genericEntities.data}->>'valueName'`,
    })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .where(where ? and(TYPE, where) : TYPE)
    /*
     * Name, then deck. 264 of the 656 share a name with a card from another
     * deck — there are five Jesters — so name alone is not a total order and
     * those rows would otherwise reshuffle between requests.
     */
    .orderBy(asc(entities.name), asc(DECK))
    .limit(CARDS_PER_PAGE)
    .offset((page - 1) * CARDS_PER_PAGE);

  return { rows, total: matched, page, pageCount };
}

export async function cardFacets(
  filters: CardFilters = {},
): Promise<CardFacetOptions> {
  const where = buildWhere(filters, "decks");

  const rows = await db
    .select({
      value: DECK,
      n: sql<number>`count(*) FILTER (WHERE ${where ?? sql`true`})`,
    })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .where(TYPE)
    .groupBy(DECK);

  const counts = rows
    .filter((row) => row.value != null)
    .map((row) => ({ value: row.value, n: Number(row.n) }));

  return {
    decks: toOptions(counts, filters.decks ?? [], (a, b) => a.localeCompare(b)),
  };
}
