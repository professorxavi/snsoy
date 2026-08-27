import { inArray, sql } from "drizzle-orm";
import {
  EMPTY_ANCHORS,
  EMPTY_AREAS,
  EMPTY_REFERENCES,
  parentKeyFor,
  sourceIdFromKey,
  sourceKeyFor,
  type AnchoredIds,
  type AreaIndex,
  type ReferenceIndex,
  type ResolvedReference,
} from "@/lib/content/references";
import { hrefFor, isFragmentType } from "@/lib/routes";
import type { EntityType } from "@/server/db/schema/enums";
import { db } from "../client";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";

/**
 * Resolves inline cross-references to URLs.
 *
 * Lookup is by natural key against a unique index, never by slugifying the tag
 * text, and references are collected for the whole page and resolved in one
 * round trip rather than one per tag.
 */

interface BookRow {
  /** Lowercased, because that is what a tag's source part resolves to. */
  id: string;
  name: string;
  href: string;
}

interface Row {
  naturalKey: string;
  name: string;
  entityType: EntityType;
  sourceId: string;
  slug: string;
}

async function fetchByKeys(keys: string[]): Promise<Row[]> {
  if (keys.length === 0) return [];
  return db
    .select({
      naturalKey: entities.naturalKey,
      name: entities.name,
      entityType: entities.entityType,
      sourceId: entities.sourceId,
      slug: entities.slug,
    })
    .from(entities)
    .where(inArray(entities.naturalKey, keys));
}

/**
 * Where each wanted book lives.
 *
 * A book is usually a source of its own and answers at `/sources/<id>`. Twenty
 * one are not: they were printed inside another book and are carried inside it,
 * keeping their own `book_id` on sections whose entity belongs to the parent's
 * source — the Yawning Portal adventures, Strixhaven's four, "No Silent Secret"
 * inside Theros. Those resolve into the book that printed them, at the chapter
 * where it begins.
 *
 * It begins at its first section in reading order, which is the inner work
 * itself in twenty of the twenty one. The exception is `TftYP-ToH`, where the
 * whole volume's Introduction is filed under the adventure and sorts ahead of
 * it — an upstream quirk, and it still lands in the right book.
 *
 * The landing spot is a chapter rather than a heading on the parent's page
 * because `groupByBook` deliberately does not split an anthology into headings:
 * an inner work reads in its place, so there is no heading to aim at.
 *
 * A book that is neither is absent from the result and its tag renders as plain
 * words, rather than a link to a page that would 404.
 */
async function fetchBooks(ids: string[]): Promise<BookRow[]> {
  if (ids.length === 0) return [];

  const [own, folded] = await Promise.all([
    db
      .select({ id: sources.id, name: sources.name })
      .from(sources)
      .where(inArray(sql`lower(${sources.id})`, ids)),
    db.execute(sql`
      SELECT DISTINCT ON (lower(bs.book_id))
             lower(bs.book_id) AS id,
             s.id   AS parent_id,
             e.name AS name,
             e.slug AS slug
      FROM book_sections bs
      JOIN entities e ON e.id = bs.entity_id
      JOIN sources s ON s.id = e.source_id
      WHERE lower(bs.book_id) = ANY(${sql.param(ids)})
        AND lower(bs.book_id) <> lower(e.source_id)
      ORDER BY lower(bs.book_id), bs.sort_order
    `) as unknown as Promise<
      { id: string; parent_id: string; name: string; slug: string }[]
    >,
  ]);

  const books = new Map<string, BookRow>();

  // Folded first, so a book carried in its own right always wins.
  for (const row of folded) {
    books.set(row.id, {
      id: row.id,
      name: row.name,
      href: `/sources/${row.parent_id.toLowerCase()}/${row.slug}`,
    });
  }

  for (const row of own) {
    books.set(row.id.toLowerCase(), {
      id: row.id.toLowerCase(),
      name: row.name,
      href: `/sources/${row.id.toLowerCase()}`,
    });
  }

  return [...books.values()];
}

/**
 * Resolve candidate natural keys to names and URLs. Keys that match nothing are
 * absent from the result, which is normal: an `{@item}` contributes three
 * candidates and only one exists.
 *
 * Entities and whole books are asked for together; a third query follows only
 * when a fragment needs its parent's URL before it can be addressed.
 */
export async function resolveReferences(
  keys: Iterable<string>,
): Promise<ReferenceIndex> {
  const wanted: string[] = [];
  const wantedSources: string[] = [];

  // A whole book is a source, not an entity, so the two are asked separately.
  for (const key of keys) {
    const sourceId = sourceIdFromKey(key);
    if (sourceId) wantedSources.push(sourceId);
    else wanted.push(key);
  }

  if (wanted.length === 0 && wantedSources.length === 0) {
    return EMPTY_REFERENCES;
  }

  const [rows, bookRows] = await Promise.all([
    fetchByKeys(wanted),
    fetchBooks(wantedSources),
  ]);

  // Fragments need their parent's URL before they can be addressed at all.
  const parentKeys = new Set<string>();
  for (const row of rows) {
    if (!isFragmentType(row.entityType)) continue;
    const parentKey = parentKeyFor(row.naturalKey);
    if (parentKey) parentKeys.add(parentKey);
  }

  const parents = new Map<string, Row>();
  for (const row of await fetchByKeys([...parentKeys])) {
    parents.set(row.naturalKey, row);
  }

  const index: Record<string, ResolvedReference> = {};

  for (const book of bookRows) {
    index[sourceKeyFor(book.id)] = { name: book.name, href: book.href };
  }

  for (const row of rows) {
    let href: string | null;

    if (isFragmentType(row.entityType)) {
      const parentKey = parentKeyFor(row.naturalKey);
      const parent = parentKey ? parents.get(parentKey) : undefined;
      href = parent ? hrefFor(row, parent) : null;
    } else {
      href = hrefFor(row);
    }

    index[row.naturalKey] = { name: row.name, entityType: row.entityType, href };
  }

  return index;
}

/* ------------------------------------------------------------------ *
 * Area anchors
 * ------------------------------------------------------------------ */

/**
 * Where each `{@area}` target lives, for one chapter of one book.
 *
 * An area addresses an entry node by the `id` the source data hangs on it, not
 * an entity by natural key, so it cannot go through `resolveReferences`. 84% of
 * the 11,393 area tags in the books point at the page they are written on and
 * 16% at another chapter of the same book; none point outside their book, and
 * none point at nothing. So the lookup is over one book's sections, and the
 * href is a bare fragment when the target is on this page and a path when it is
 * not.
 *
 * Ids are only unique within a section — three tags in every address the books hold
 * one that repeats — so a duplicate resolves to whichever row comes back first
 * rather than being dropped.
 */
export interface AreaLinks {
  /** Where the tags written on this page point. */
  hrefs: AreaIndex;
  /** Which of this page's nodes have to carry an anchor of their own. */
  anchored: AnchoredIds;
}

export async function resolveAreas(
  sourceId: string,
  chapterSlug: string,
  ids: Iterable<string>,
): Promise<AreaLinks> {
  const wanted = [...ids];

  const [hrefs, anchored] = await Promise.all([
    wanted.length ? areaHrefs(sourceId, chapterSlug, wanted) : EMPTY_AREAS,
    anchoredInBook(sourceId),
  ]);

  return { hrefs, anchored };
}

/** Where each wanted id lives, as a fragment on this page or a path off it. */
async function areaHrefs(
  sourceId: string,
  chapterSlug: string,
  wanted: string[],
): Promise<AreaIndex> {
  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (n->>'id')
           n->>'id' AS id,
           e.slug   AS slug
    FROM book_sections bs
    JOIN entities e ON e.id = bs.entity_id,
         LATERAL jsonb_path_query(bs.data, '$.**') n
    WHERE e.source_id = ${sourceId}
      AND n ? 'id'
      AND n->>'id' = ANY(${sql.param(wanted)})
    -- The page being read wins a tie, so a same-page target never becomes a
    -- navigation away from it.
    ORDER BY n->>'id', (e.slug = ${chapterSlug}) DESC
  `)) as unknown as { id: string; slug: string }[];

  const index: Record<string, string> = {};
  for (const row of rows) {
    index[row.id] =
      row.slug === chapterSlug
        ? `#${row.id}`
        : `/sources/${sourceId.toLowerCase()}/${row.slug}#${row.id}`;
  }

  return index;
}

/**
 * Every id anything in the book points at, read off the tags rather than the
 * nodes. A page is the target of chapters it never mentions, so it cannot work
 * this out from its own text — and marking only what a page points at would
 * leave every cross-chapter link landing nowhere.
 */
async function anchoredInBook(sourceId: string): Promise<AnchoredIds> {
  const rows = (await db.execute(sql`
    SELECT DISTINCT (string_to_array(m[1], '|'))[2] AS id
    FROM book_sections bs
    JOIN entities e ON e.id = bs.entity_id,
         LATERAL regexp_matches(bs.data::text, '\{@area ([^{}]*)\}', 'g') m
    WHERE e.source_id = ${sourceId}
  `)) as unknown as { id: string | null }[];

  const anchored: Record<string, true> = {};
  for (const row of rows) if (row.id) anchored[row.id] = true;

  return Object.keys(anchored).length ? anchored : EMPTY_ANCHORS;
}
