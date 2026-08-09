import { and, eq, ilike } from "drizzle-orm";
import { db } from "../client";
import { monsters } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";

/**
 * Monster queries.
 *
 * Only the detail query so far. Creatures are what book text points at more
 * than anything else — 15,887 `{@creature}` references, more than spells, items
 * and conditions together — and every one of them opens in the aside, so the
 * stat block is worth having before the browse list that will also need it.
 *
 * The whole stat block is read out of `data`. The typed columns beside it exist
 * for the filtering the browse list will do and are lossy for display: see the
 * note at the top of `@/lib/content/monsters`.
 */

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
    })
    .from(monsters)
    .innerJoin(entities, eq(entities.id, monsters.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
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

  return row ?? null;
}
