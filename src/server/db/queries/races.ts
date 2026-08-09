import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { NPC_RACE_TAG, type AbilityBonus, type RaceSpeed } from "@/lib/content/races";
import { db } from "../client";
import { races } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";

/**
 * Race queries.
 *
 * Races and subraces share one table, distinguished by `parent_race_id` and
 * entity type, so a race and its subraces come back together.
 *
 * No filtering or paging: there are only 134 races, the landing page is a
 * grouped list, and the entity page is a reading view.
 */

const displayColumns = {
  size: sql<string[] | null>`${races.data}->'size'`,
  speed: sql<RaceSpeed | null>`${races.data}->'speed'`,
  ability: sql<AbilityBonus[] | null>`${races.data}->'ability'`,
};

export type RaceListGroup = Awaited<ReturnType<typeof listRacesBySource>>[number];
export type RaceListItem = RaceListGroup["races"][number];

/**
 * Orders books by kind rather than publication date. `sources.sortOrder` is
 * chronological, which puts minor one-race releases ahead of the major
 * supplements. `sortOrder` still breaks ties within a rank.
 */
const GROUP_RANK = sql<number>`
  CASE ${sources.group}
    WHEN 'core' THEN 0
    WHEN 'supplement' THEN 1
    WHEN 'setting' THEN 2
    WHEN 'setting-alt' THEN 3
    WHEN 'supplement-alt' THEN 4
    ELSE 5
  END
`;

/**
 * Races printed for building NPCs rather than for play. Hidden from the list
 * but still reachable by URL, search and bookmark.
 *
 * `coalesce` because `trait_tags` is nullable, and `NULL @> ARRAY[...]` is NULL
 * rather than false, which would drop every untagged race from the list.
 */
const IS_NPC_RACE = sql<boolean>`
  coalesce(${races.traitTags}, '{}') @> ARRAY[${NPC_RACE_TAG}]::text[]
`;

/**
 * Every race, grouped by the book that printed it. Subraces are excluded, since
 * they render as sections of their parent's page, and so are NPC races.
 */
export async function listRacesBySource() {
  const rows = await db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      sourceName: sources.name,
      ...displayColumns,
    })
    .from(races)
    .innerJoin(entities, eq(entities.id, races.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(and(eq(entities.entityType, "race"), sql`NOT ${IS_NPC_RACE}`))
    // Ordering by unselected columns keeps sort keys out of the row shape.
    .orderBy(GROUP_RANK, asc(sources.sortOrder), asc(entities.name));

  const groups: {
    sourceId: string;
    sourceName: string;
    races: (typeof rows)[number][];
  }[] = [];

  for (const race of rows) {
    const last = groups[groups.length - 1];
    if (last && last.sourceId === race.sourceId) {
      last.races.push(race);
      continue;
    }
    groups.push({
      sourceId: race.sourceId,
      sourceName: race.sourceName,
      races: [race],
    });
  }

  return groups;
}

export type RaceDetail = NonNullable<Awaited<ReturnType<typeof getRace>>>;
export type SubraceDetail = RaceDetail["subraces"][number];

/**
 * One race with its subraces. Two queries rather than a join, so the parent's
 * `data` blob is not repeated across every subrace row.
 *
 * Unfiltered: NPC races are hidden from the list but must still open here.
 */
export async function getRace(sourceId: string, slug: string) {
  const [race] = await db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      sourceName: sources.name,
      page: entities.page,
      fluff: entities.fluff,
      data: races.data,
      isNpcRace: IS_NPC_RACE,
      ...displayColumns,
    })
    .from(races)
    .innerJoin(entities, eq(entities.id, races.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(
      and(
        eq(entities.entityType, "race"),
        ilike(entities.sourceId, sourceId),
        eq(entities.slug, slug),
      ),
    )
    .limit(1);

  if (!race) return null;

  const subraces = await db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      // The page prints book names, not abbreviations. Roughly half of all
      // subraces come from a different book than their parent race.
      sourceName: sources.name,
      page: entities.page,
      data: races.data,
      ...displayColumns,
    })
    .from(races)
    .innerJoin(entities, eq(entities.id, races.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(eq(races.parentRaceId, race.id))
    .orderBy(asc(entities.name));

  return { ...race, subraces };
}

/** Every race URL, for `generateStaticParams` and for sitemap work later. */
export async function allRaceParams() {
  const rows = await db
    .select({ sourceId: entities.sourceId, slug: entities.slug })
    .from(entities)
    .where(eq(entities.entityType, "race"));

  return rows.map((row) => ({
    source: row.sourceId.toLowerCase(),
    slug: row.slug,
  }));
}
