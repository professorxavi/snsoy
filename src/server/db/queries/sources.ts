import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { neighbours } from "@/lib/content/chapters";
import { db } from "../client";
import { bookSections } from "../schema/books";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";

/**
 * Source and chapter queries, behind `/sources`.
 *
 * Books and adventures share one tree: both are `sources` rows whose body text
 * lives in `book_sections`, and both render through the same reader.
 *
 * No paging anywhere. There are 130 sources with body text and the longest has
 * 30 chapters, so every list here is short enough to sort in one query.
 */

/**
 * Chapter order within a source. Never `ordinal` alone: a source with two
 * bodies restarts the count, so MOT's ordinal 0 appears twice. The primary body
 * — the one whose `book_id` matches the source — comes first, and any inner
 * work follows it.
 */
const CHAPTER_ORDER = [
  sql`(${bookSections.bookId} = ${entities.sourceId}) DESC`,
  asc(bookSections.bookId),
  asc(bookSections.ordinal),
];

/**
 * Sources the ingest synthesised because an entity cited a source id with no
 * book entry behind it. They carry no name, cover or body — `name` is just the
 * id repeated. Hidden from the index for the same reason NPC races are: nothing
 * useful renders. Their pages still resolve, since entity pages link to them.
 */
const SYNTHESISED = eq(sources.group, "unlisted");

export type SourceListItem = Awaited<ReturnType<typeof listSources>>[number];

/**
 * Every source worth showing, with how many chapters it has. Ordered by kind
 * and then chronologically, so the core rulebooks lead and the rest reads as a
 * publication history.
 *
 * `chapterCount` decides whether a card opens the reader. Every listed source
 * has body text today, so it never reads zero — but it is what the index shows
 * per card, and a source can be cited before its body is loaded.
 */
export async function listSources() {
  return db
    .select({
      id: sources.id,
      name: sources.name,
      group: sources.group,
      published: sources.published,
      coverPath: sources.coverPath,
      isAdventure: sources.isAdventure,
      chapterCount: sql<number>`
        count(${entities.id}) FILTER (WHERE ${entities.entityType} = 'bookSection')
      `.mapWith(Number),
    })
    .from(sources)
    .leftJoin(entities, eq(entities.sourceId, sources.id))
    .where(sql`NOT ${SYNTHESISED}`)
    .groupBy(sources.id)
    .orderBy(asc(sources.sortOrder), asc(sources.name));
}

export type SourceDetail = NonNullable<Awaited<ReturnType<typeof getSource>>>;
export type ChapterListItem = SourceDetail["chapters"][number];

/** One source with its chapter list. */
export async function getSource(sourceId: string) {
  const [source] = await db
    .select({
      id: sources.id,
      name: sources.name,
      group: sources.group,
      published: sources.published,
      author: sources.author,
      coverPath: sources.coverPath,
      isAdventure: sources.isAdventure,
    })
    .from(sources)
    .where(ilike(sources.id, sourceId))
    .limit(1);

  if (!source) return null;

  const chapters = await db
    .select({
      name: entities.name,
      slug: entities.slug,
      page: entities.page,
      bookId: bookSections.bookId,
      ordinalType: bookSections.ordinalType,
      ordinalLabel: bookSections.ordinalLabel,
      headers: bookSections.headers,
    })
    .from(bookSections)
    .innerJoin(entities, eq(entities.id, bookSections.entityId))
    .where(eq(entities.sourceId, source.id))
    .orderBy(...CHAPTER_ORDER);

  return { ...source, chapters };
}

export type ChapterDetail = NonNullable<Awaited<ReturnType<typeof getChapter>>>;

/**
 * One chapter, with the chapters either side of it.
 *
 * The neighbours come from a window over the whole source rather than a second
 * lookup by ordinal, because ordinals are not contiguous across two bodies —
 * stepping forward from MOT's last chapter has to land in MOT-NSS.
 */
export async function getChapter(sourceId: string, slug: string) {
  const [chapter] = await db
    .select({
      id: entities.id,
      naturalKey: entities.naturalKey,
      name: entities.name,
      slug: entities.slug,
      sourceId: entities.sourceId,
      sourceName: sources.name,
      isAdventure: sources.isAdventure,
      page: entities.page,
      bookId: bookSections.bookId,
      ordinalType: bookSections.ordinalType,
      ordinalLabel: bookSections.ordinalLabel,
      data: bookSections.data,
    })
    .from(bookSections)
    .innerJoin(entities, eq(entities.id, bookSections.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(and(ilike(entities.sourceId, sourceId), eq(entities.slug, slug)))
    .limit(1);

  if (!chapter) return null;

  const siblings = await db
    .select({
      name: entities.name,
      slug: entities.slug,
      ordinalType: bookSections.ordinalType,
      ordinalLabel: bookSections.ordinalLabel,
    })
    .from(bookSections)
    .innerJoin(entities, eq(entities.id, bookSections.entityId))
    .where(eq(entities.sourceId, chapter.sourceId))
    .orderBy(...CHAPTER_ORDER);

  return { ...chapter, ...neighbours(siblings, chapter.slug) };
}

/** Every chapter URL, for `generateStaticParams` and sitemap work later. */
export async function allChapterParams() {
  const rows = await db
    .select({ sourceId: entities.sourceId, slug: entities.slug })
    .from(entities)
    .where(eq(entities.entityType, "bookSection"));

  return rows.map((row) => ({
    source: row.sourceId.toLowerCase(),
    chapter: row.slug,
  }));
}
