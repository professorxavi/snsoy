import { and, asc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "../client";
import { genericEntities } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";

/**
 * Skill queries.
 *
 * Skills are `generic_entities` rows, so the ability comes out of the JSON
 * rather than a typed column. There are eighteen of them from one book: no
 * filtering, no paging, no facets — the whole list is one screen, and a rail
 * that narrowed eighteen rows would cost more attention than it saved.
 */

/** Read from the blob, since a generic entity has no columns of its own. */
const ability = sql<string | null>`${genericEntities.data}->>'ability'`;

/**
 * Sheet order — Strength through Charisma — not alphabetical. Anything the
 * array does not name sorts last rather than first.
 */
const ABILITY_RANK = sql<number>`
  coalesce(
    array_position(
      ARRAY['str','dex','con','int','wis','cha']::text[],
      ${genericEntities.data}->>'ability'
    ),
    99
  )
`;

export type SkillSort = "name" | "ability";
export type SkillRow = Awaited<ReturnType<typeof listSkills>>[number];

/**
 * Every skill. Ability ties break by name, so the two orders differ only in
 * their grouping and neither is unstable.
 */
export async function listSkills(sort: SkillSort = "name") {
  const orderBy: SQL[] =
    sort === "ability" ? [ABILITY_RANK, asc(entities.name)] : [asc(entities.name)];

  return db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      ability,
    })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .where(eq(entities.entityType, "skill"))
    .orderBy(...orderBy);
}

export type SkillDetail = NonNullable<Awaited<ReturnType<typeof getSkill>>>;

/** One skill by source and slug, which is unique with the entity type. */
export async function getSkill(sourceId: string, slug: string) {
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
      ability,
    })
    .from(genericEntities)
    .innerJoin(entities, eq(entities.id, genericEntities.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    // `generic_entities` holds a dozen types, so the type predicate is what
    // stops `/skills/phb/prone` from serving the condition of that name.
    .where(
      and(
        eq(entities.entityType, "skill"),
        // Source ids are mixed case in the data but lowercase in URLs.
        ilike(entities.sourceId, sourceId),
        eq(entities.slug, slug),
      ),
    )
    .limit(1);

  return row ?? null;
}
