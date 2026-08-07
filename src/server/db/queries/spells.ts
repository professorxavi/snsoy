import { and, asc, eq, ilike, sql } from "drizzle-orm";
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
 * Spell queries.
 *
 * The list is fetched **whole**, unfiltered and unpaginated. That is a
 * deliberate trade and it rests on one number: there are 525 spells. Their list
 * columns come to a few hundred bytes each, so the entire browsable set is a
 * small payload — and once it is on the client, filtering, searching, sorting
 * and facet counts are all instant, with no round trip between a keystroke and
 * the table updating.
 *
 * This does not generalise. Monsters (3,808) and items (3,501) are large enough
 * that their slices will need server-side filtering and virtualization; whether
 * to send everything is a decision made per type, on the size of that type.
 *
 * Display values come from the original `data` object rather than the typed
 * columns beside it, because the typed columns are lossy by design — see the
 * note in `@/lib/content/spells`.
 *
 * No `is_srd` condition anywhere, on purpose: the public build is a separate
 * seed containing only SRD rows, so there is nothing to gate at runtime.
 * Source-level access control arrives whole in Phase 6.
 */

/** The display shapes, pulled out of the untouched corpus object. */
const displayColumns = {
  time: sql<SpellTime[] | null>`${spells.data}->'time'`,
  range: sql<SpellRange | null>`${spells.data}->'range'`,
  components: sql<SpellComponents | null>`${spells.data}->'components'`,
  duration: sql<SpellDuration[] | null>`${spells.data}->'duration'`,
};

export type SpellRow = Awaited<ReturnType<typeof allSpells>>[number];

/**
 * Every spell, for the browse view.
 *
 * Sorted by name here rather than on the client so the server-rendered HTML
 * arrives in its default order — the client re-sorts only when the reader asks
 * for something else.
 */
export async function allSpells() {
  return db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      level: spells.level,
      school: spells.school,
      castingTimeUnit: spells.castingTimeUnit,
      isConcentration: spells.isConcentration,
      isRitual: spells.isRitual,
      classes: spells.classes,
      ...displayColumns,
    })
    .from(spells)
    .innerJoin(entities, eq(entities.id, spells.entityId))
    .orderBy(asc(entities.name));
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
