import { and, asc, eq, ilike, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { classes, classFeatures, subclasses } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";

/**
 * Class queries.
 *
 * A class is four kinds of row: the class, its base features, its subclasses,
 * and those subclasses' features — 16, 352, 124 and 880 of them. All four are
 * fetched for one page, because a class page is the whole class; there is no
 * useful partial view of one.
 *
 * Features and subclasses are read by `class_id`, never by source. Roughly half
 * of a PHB class's subclasses were printed in a later book, and Tasha's adds
 * features to classes it did not print — a Fighter's `Martial Versatility` is a
 * TCE row hanging off a PHB class. Filtering by source would silently drop them.
 */

const GROUP_RANK = sql<number>`
  CASE ${sources.group}
    WHEN 'core' THEN 0
    WHEN 'supplement' THEN 1
    WHEN 'setting' THEN 2
    ELSE 3
  END
`;

/**
 * Sidekicks are `class` rows, and the corpus says so itself. They are kept out
 * of the class list and given one of their own: a sidekick is a companion a
 * small party adopts, not something a player rolls up, and three of them among
 * the twelve is a category error on the page that matters most.
 *
 * Read from the blob rather than a column of its own. Adding one would mean an
 * ingest run, and this is three rows out of sixteen.
 */
const IS_SIDEKICK = sql<boolean>`
  coalesce((${classes.data}->>'isSidekick')::boolean, false)
`;

export type ClassListGroup = Awaited<ReturnType<typeof listClassesBySource>>[number];
export type ClassListItem = ClassListGroup["classes"][number];

/** The columns a list row needs, whether it is a class or a sidekick. */
const listColumns = {
  id: entities.id,
  name: entities.name,
  slug: entities.slug,
  sourceId: entities.sourceId,
  sourceName: sources.name,
  page: entities.page,
  hitDie: classes.hitDie,
  casterProgression: classes.casterProgression,
  spellcastingAbility: classes.spellcastingAbility,
  savingThrows: classes.savingThrowProficiencies,
  subclassTitle: classes.subclassTitle,
  subclassCount: sql<number>`(
    SELECT count(*)::int FROM ${subclasses}
    WHERE ${subclasses.classId} = ${classes.entityId}
  )`,
};

/**
 * Every class, grouped by the book that printed it. Twelve are the PHB's and
 * one is a supplement's. Sidekicks are excluded — they have a list of their own.
 */
export async function listClassesBySource() {
  const rows = await db
    .select(listColumns)
    .from(classes)
    .innerJoin(entities, eq(entities.id, classes.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(sql`NOT ${IS_SIDEKICK}`)
    .orderBy(GROUP_RANK, asc(sources.sortOrder), asc(entities.name));

  const groups: {
    sourceId: string;
    sourceName: string;
    classes: (typeof rows)[number][];
  }[] = [];

  for (const entry of rows) {
    const last = groups[groups.length - 1];
    if (last && last.sourceId === entry.sourceId) {
      last.classes.push(entry);
      continue;
    }
    groups.push({
      sourceId: entry.sourceId,
      sourceName: entry.sourceName,
      classes: [entry],
    });
  }

  return groups;
}

export type SidekickListItem = Awaited<ReturnType<typeof listSidekicks>>[number];

/**
 * The sidekicks, flat. All three come from one book, so there is nothing to
 * group them by, and a list of three does not need paging or a filter.
 */
export async function listSidekicks() {
  return db
    .select(listColumns)
    .from(classes)
    .innerJoin(entities, eq(entities.id, classes.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(IS_SIDEKICK)
    .orderBy(asc(entities.name));
}

export type ClassDetail = NonNullable<Awaited<ReturnType<typeof getClass>>>;
export type ClassFeatureDetail = ClassDetail["features"][number];
export type SubclassDetail = ClassDetail["subclasses"][number];

/** The columns every feature row carries, base and subclass alike. */
const featureColumns = {
  id: entities.id,
  naturalKey: entities.naturalKey,
  name: entities.name,
  slug: entities.slug,
  sourceId: entities.sourceId,
  sourceName: sources.name,
  page: entities.page,
  level: classFeatures.level,
  subclassId: classFeatures.subclassId,
  isAbilityScoreImprovement: classFeatures.isAbilityScoreImprovement,
  data: classFeatures.data,
};

/**
 * One class with everything printed under it.
 *
 * Three queries, not a join: a class's `data` blob carries its whole progression
 * table, and joining would repeat it across all 23 feature rows.
 *
 * Feature order is level, then name. The printed order within a level lives in
 * the class's own `classFeatures` array and is applied by the caller — see
 * `byPrintedOrder` in `lib/content/classes`.
 */
export async function getClass(sourceId: string, slug: string) {
  const [found] = await db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      sourceName: sources.name,
      page: entities.page,
      fluff: entities.fluff,
      hitDie: classes.hitDie,
      casterProgression: classes.casterProgression,
      spellcastingAbility: classes.spellcastingAbility,
      preparesSpells: classes.preparesSpells,
      savingThrows: classes.savingThrowProficiencies,
      subclassTitle: classes.subclassTitle,
      data: classes.data,
    })
    .from(classes)
    .innerJoin(entities, eq(entities.id, classes.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(
      and(
        eq(entities.entityType, "class"),
        ilike(entities.sourceId, sourceId),
        eq(entities.slug, slug),
      ),
    )
    .limit(1);

  if (!found) return null;

  const [features, subclassRows] = await Promise.all([
    db
      .select(featureColumns)
      .from(classFeatures)
      .innerJoin(entities, eq(entities.id, classFeatures.entityId))
      .innerJoin(sources, eq(sources.id, entities.sourceId))
      .where(
        and(
          eq(classFeatures.classId, found.id),
          // Base features only. A subclass's features belong to the subclass,
          // which prints them under its own heading.
          isNull(classFeatures.subclassId),
        ),
      )
      .orderBy(asc(classFeatures.level), asc(entities.name)),

    db
      .select({
        id: entities.id,
        naturalKey: entities.naturalKey,
        name: entities.name,
        slug: entities.slug,
        sourceId: entities.sourceId,
        sourceName: sources.name,
        page: entities.page,
        shortName: subclasses.shortName,
        casterProgression: subclasses.casterProgression,
        spellcastingAbility: subclasses.spellcastingAbility,
        data: subclasses.data,
      })
      .from(subclasses)
      .innerJoin(entities, eq(entities.id, subclasses.entityId))
      .innerJoin(sources, eq(sources.id, entities.sourceId))
      .where(eq(subclasses.classId, found.id))
      .orderBy(GROUP_RANK, asc(sources.sortOrder), asc(entities.name)),
  ]);

  const subclassFeatures = await db
    .select(featureColumns)
    .from(classFeatures)
    .innerJoin(entities, eq(entities.id, classFeatures.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(
      and(
        eq(classFeatures.classId, found.id),
        isNotNull(classFeatures.subclassId),
      ),
    )
    .orderBy(asc(classFeatures.level), asc(entities.name));

  return {
    ...found,
    features,
    subclasses: subclassRows.map((subclass) => ({
      ...subclass,
      features: subclassFeatures.filter(
        (feature) => feature.subclassId === subclass.id,
      ),
    })),
  };
}

/** Every class URL, for `generateStaticParams` and sitemap work later. */
export async function allClassParams() {
  const rows = await db
    .select({ sourceId: entities.sourceId, slug: entities.slug })
    .from(entities)
    .where(eq(entities.entityType, "class"));

  return rows.map((row) => ({
    source: row.sourceId.toLowerCase(),
    slug: row.slug,
  }));
}
