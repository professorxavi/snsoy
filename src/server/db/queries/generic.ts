import { and, asc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "../client";
import { genericEntities } from "../schema/content";
import { entities } from "../schema/entities";
import type { EntityType } from "../schema/enums";
import { sources } from "../schema/sources";

/**
 * Reads for the types stored in `generic_entities`.
 *
 * That table is one `data jsonb` blob per entity and nothing else, and it holds
 * 22 of the 32 browsable types — two thirds of what the compendium still has to
 * build. So this is the read path for most of them rather than one slice's
 * machinery. `queries/skills.ts` and `queries/conditions.ts` are already the
 * same two queries written twice; without this the next five types would have
 * written them a third through a seventh time.
 *
 * What varies per type is only which keys come out of the blob, so that is the
 * parameter. What must never vary is the type predicate: every one of those 22
 * types lives in this one table, and the predicate is the only thing stopping
 * `/skills/phb/prone` from serving the *condition* of that name.
 */

/**
 * Which JSON keys a type wants alongside the registry columns, as
 * `alias -> key`.
 *
 * Everything comes back as text whatever it is in the blob, because `->>` is
 * what a table cell and a subtitle line both want. A key a row does not carry
 * reads as null rather than going missing, so every row of a type has the same
 * shape whether or not the book filled that field in.
 */
export type FieldMap = Readonly<Record<string, string>>;

/** What the registry answers for a list row, whatever the type. */
export interface GenericListRow {
  id: string;
  name: string;
  slug: string;
  sourceId: string;
}

export type GenericRow<F extends FieldMap> = GenericListRow & {
  readonly [K in keyof F]: string | null;
};

/**
 * One entity with its blob, before any field map is applied.
 *
 * Named separately from `GenericDetail` because it is what the aside takes.
 * `GenericDetail<FieldMap>` looks like the general case and is not one: mapping
 * over `Record<string, string>` gives a string index signature, which no
 * concrete row satisfies. This is the type a renderer wants anyway — the map
 * exists to fill a table cell, and the aside has the whole blob.
 */
export interface GenericEntity extends GenericListRow {
  naturalKey: string;
  page: number | null;
  sourceName: string;
  data: Record<string, unknown>;
}

export type GenericDetail<F extends FieldMap> = GenericEntity & {
  readonly [K in keyof F]: string | null;
};

/**
 * The field map as a Drizzle projection. Keys are our own constants, never
 * anything a reader typed, and `jsonb ->> text` takes a bound parameter without
 * ambiguity — so the key travels as a parameter rather than as interpolated SQL.
 */
function jsonFields(fields: FieldMap): Record<string, SQL<string | null>> {
  return Object.fromEntries(
    Object.entries(fields).map(([alias, key]) => [
      alias,
      sql<string | null>`${genericEntities.data}->>${key}`,
    ]),
  );
}

/**
 * Every entity of one generic type, optionally narrowed by name.
 *
 * No paging: the largest of these types is 135 rows, which is one screen of
 * table and cheaper to send whole than to split. A type that outgrows that
 * wants the spells shape, not another argument here.
 */
export async function listGeneric<F extends FieldMap>(
  type: EntityType,
  fields: F,
  q?: string,
): Promise<GenericRow<F>[]> {
  const clauses: SQL[] = [eq(entities.entityType, type)];

  const term = q?.trim();
  if (term) clauses.push(ilike(entities.name, `%${term}%`));

  const rows = await db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      ...jsonFields(fields),
    })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .where(and(...clauses))
    /*
     * Name, then source. Name alone is not a total order here the way it is for
     * skills and conditions: 40 of the 135 languages share a name with one from
     * another book — three of them are called Common — and 5 variant rules do
     * the same. Without the second key those rows arrive in whatever order the
     * scan happened to produce, which is a list that reshuffles under the reader
     * for no reason they can see.
     */
    .orderBy(asc(entities.name), asc(entities.sourceId));

  return rows as GenericRow<F>[];
}

/**
 * One entity by type, source and slug — unique together, which is what the URL
 * scheme rests on.
 */
export async function getGeneric<F extends FieldMap>(
  type: EntityType,
  sourceId: string,
  slug: string,
  fields: F,
): Promise<GenericDetail<F> | null> {
  const [row] = await db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      page: entities.page,
      sourceName: sources.name,
      data: genericEntities.data,
      ...jsonFields(fields),
    })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(
      and(
        eq(entities.entityType, type),
        // Source ids are mixed case in the data but lowercase in URLs.
        ilike(entities.sourceId, sourceId),
        eq(entities.slug, slug),
      ),
    )
    .limit(1);

  return (row as GenericDetail<F> | undefined) ?? null;
}
