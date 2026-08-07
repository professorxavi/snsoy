import { and, asc, eq, ilike, sql } from "drizzle-orm";
import type { AbilityBonus, RaceSpeed } from "@/lib/content/races";
import { db } from "../client";
import { races } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";

/**
 * Race queries.
 *
 * Races and subraces share one table, distinguished by `parent_race_id` and by
 * their entity type — which is what lets a race and everything nested inside it
 * come back together, in the order the page renders them.
 *
 * There is no filtering or paging here on purpose. Races are not a comparison
 * task the way spells are: 134 of them, read one at a time, each a small
 * document rather than a row of values. The landing page is a grouped list and
 * the entity page is a reading view, so neither needs a filter rail.
 */

const displayColumns = {
  size: sql<string[] | null>`${races.data}->'size'`,
  speed: sql<RaceSpeed | null>`${races.data}->'speed'`,
  ability: sql<AbilityBonus[] | null>`${races.data}->'ability'`,
};

export type RaceListGroup = Awaited<ReturnType<typeof listRacesBySource>>[number];
export type RaceListItem = RaceListGroup["races"][number];

/**
 * Where a book sits in the list, by kind rather than by publication date.
 *
 * `sources.sortOrder` is chronological, which puts the Plane Shift PDFs — six
 * pages each, one race apiece — third, ahead of Volo's and Tasha's. That is the
 * wrong answer for a reader: the ordering people expect is core books, then the
 * big supplements, then setting books, then the odds and ends. `sources.group`
 * already carries that distinction, so rank by it and let `sortOrder` break
 * ties within a rank.
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
 * Every race, grouped by the book that printed it.
 *
 * Grouped rather than alphabetical because "the Player's Handbook ones" is how
 * people actually reach for a race, and because a flat A–Z list mixes the nine
 * everyone knows in among 125 they do not.
 *
 * Subraces are deliberately absent: they are sections of their parent's page,
 * not entries in this list.
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
    .where(eq(entities.entityType, "race"))
    // Ordering by columns that are not selected is fine, and keeps the row
    // shape free of sort keys the page has no use for.
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
 * One race, with every subrace that hangs off it.
 *
 * Two queries rather than a join: the subraces are a second list rather than
 * extra columns, and the parent's `data` blob is large enough that repeating it
 * across thirteen Tiefling rows would be the dominant cost of the page.
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
      page: entities.page,
      data: races.data,
      ...displayColumns,
    })
    .from(races)
    .innerJoin(entities, eq(entities.id, races.entityId))
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
