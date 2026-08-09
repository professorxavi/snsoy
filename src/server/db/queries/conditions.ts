import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "../client";
import { genericEntities } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";

/**
 * Condition queries.
 *
 * Fifteen rows from one book, and — unlike a skill, which at least has an
 * ability — nothing typed to order or group by. So there is one order, and no
 * filtering, paging or facets to build.
 */

export type ConditionRow = Awaited<ReturnType<typeof listConditions>>[number];

/** Every condition, alphabetically. */
export async function listConditions() {
  return db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
    })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .where(eq(entities.entityType, "condition"))
    .orderBy(asc(entities.name));
}

export type ConditionDetail = NonNullable<
  Awaited<ReturnType<typeof getCondition>>
>;

/** One condition by source and slug, which is unique with the entity type. */
export async function getCondition(sourceId: string, slug: string) {
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
    })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    // `generic_entities` holds a dozen types, several of them from this same
    // book: Concentration and Surprised are statuses, not conditions, and the
    // type predicate is the only thing keeping them out of this answer.
    .where(
      and(
        eq(entities.entityType, "condition"),
        // Source ids are mixed case in the data but lowercase in URLs.
        ilike(entities.sourceId, sourceId),
        eq(entities.slug, slug),
      ),
    )
    .limit(1);

  return row ?? null;
}
