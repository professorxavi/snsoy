import { inArray, sql } from "drizzle-orm";
import {
  EMPTY_ANCHORS,
  EMPTY_AREAS,
  EMPTY_REFERENCES,
  parentKeyFor,
  sourceIdFromKey,
  sourceKeyFor,
  tableTargetFromKey,
  type AnchoredIds,
  type AreaIndex,
  type ReferenceIndex,
  type ResolvedReference,
} from "@/lib/content/references";
import { splitSections } from "@/lib/content/outline";
import { tableAnchorId } from "@/lib/content/tables";
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
  const wantedTables: TableTarget[] = [];

  // Neither a whole book nor a table inside a chapter is an entity, so each is
  // asked for separately and merged back into one index.
  for (const key of keys) {
    const sourceId = sourceIdFromKey(key);
    if (sourceId) {
      wantedSources.push(sourceId);
      continue;
    }

    const table = tableTargetFromKey(key);
    if (table) {
      wantedTables.push({ ...table, key });
      continue;
    }

    wanted.push(key);
  }

  if (
    wanted.length === 0 &&
    wantedSources.length === 0 &&
    wantedTables.length === 0
  ) {
    return EMPTY_REFERENCES;
  }

  const [rows, bookRows, tableRows] = await Promise.all([
    fetchByKeys(wanted),
    fetchBooks(wantedSources),
    fetchTableAnchors(wantedTables),
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

  for (const table of tableRows) {
    index[table.key] = { name: table.name, href: table.href };
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
 * Table anchors
 * ------------------------------------------------------------------ */

interface TableTarget {
  caption: string;
  source: string;
  key: string;
}

/** A located table: a chapter of its book, or the class page a feature is on. */
interface TableRow {
  caption: string;
  source: string;
  display: string;
  slug: string | null;
  classHref: string | null;
  /** Set only where the section above an uncaptioned table is the target. */
  anchor?: string;
}

/** Whether a section holds a table anywhere beneath it. */
function holdsTable(entries: unknown): boolean {
  if (Array.isArray(entries)) return entries.some(holdsTable);
  if (!entries || typeof entries !== "object") return false;

  const node = entries as Record<string, unknown>;
  if (node["type"] === "table" || node["type"] === "tableGroup") return true;

  return Object.values(node).some(holdsTable);
}

/**
 * Where each wanted table is printed.
 *
 * A `{@table}` names a table by caption and book, and all but seven of them are
 * printed inside a chapter rather than held as entities — so this asks
 * `book_sections` for the chapter carrying a `table` or `tableGroup` node of
 * that caption, and addresses it by the anchor `tableAnchorId` derives.
 *
 * Unlike `{@area}`, which never points outside its own book, a table is cited
 * across books — the DMG's magic item tables are rolled on from a dozen
 * adventures. The tag names the source, though, so the scan is still bounded by
 * the sources actually asked for rather than by the book being read.
 *
 * A caption repeated within one book resolves to whichever chapter comes first
 * in reading order, which is where the book prints the table it defines.
 */
async function fetchTableAnchors(
  targets: TableTarget[],
): Promise<{ key: string; name: string; href: string }[]> {
  if (targets.length === 0) return [];

  const captions = [...new Set(targets.map((t) => t.caption))];
  const sources = [...new Set(targets.map((t) => t.source))];

  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (lower(coalesce(n->>'caption', n->>'name')), lower(e.source_id))
           lower(coalesce(n->>'caption', n->>'name')) AS caption,
           lower(e.source_id)                         AS source,
           coalesce(n->>'caption', n->>'name')        AS display,
           e.slug                                     AS slug
    FROM book_sections bs
    JOIN entities e ON e.id = bs.entity_id,
         LATERAL jsonb_path_query(bs.data, '$.**') n
    WHERE n->>'type' IN ('table', 'tableGroup')
      AND lower(e.source_id) = ANY(${sql.param(sources)})
      AND lower(coalesce(n->>'caption', n->>'name')) = ANY(${sql.param(captions)})
    ORDER BY lower(coalesce(n->>'caption', n->>'name')),
             lower(e.source_id),
             bs.sort_order
  `)) as unknown as {
    caption: string;
    source: string;
    display: string;
    slug: string;
  }[];

  const found = new Map<string, TableRow>(
    rows.map((r) => [`${r.caption}|${r.source}`, { ...r, classHref: null }]),
  );

  /*
   * A handful of tables are printed inside a class feature rather than a
   * chapter — the sorcerer's Wild Magic Surge is 30 of the 33 — so the ones a
   * chapter could not answer for are asked of the features, which render on
   * their class's page and anchor their tables the same way.
   *
   * Second, and only where the first came up short, because most pages resolve
   * every table they cite from the chapters alone.
   */
  const unresolved = targets.filter(
    (target) => !found.has(`${target.caption}|${target.source}`),
  );

  if (unresolved.length > 0) {
    const featureRows = (await db.execute(sql`
      SELECT DISTINCT ON (lower(coalesce(n->>'caption', n->>'name')), lower(e.source_id))
             lower(coalesce(n->>'caption', n->>'name')) AS caption,
             lower(e.source_id)                         AS source,
             coalesce(n->>'caption', n->>'name')        AS display,
             lower(c.source_id)                         AS class_source,
             c.slug                                     AS class_slug
      FROM class_features cf
      JOIN entities e ON e.id = cf.entity_id
      JOIN entities c ON c.id = cf.class_id,
           LATERAL jsonb_path_query(cf.data, '$.**') n
      WHERE n->>'type' IN ('table', 'tableGroup')
        AND lower(e.source_id) = ANY(${sql.param([...new Set(unresolved.map((t) => t.source))])})
        AND lower(coalesce(n->>'caption', n->>'name')) = ANY(${sql.param([...new Set(unresolved.map((t) => t.caption))])})
      ORDER BY lower(coalesce(n->>'caption', n->>'name')),
               lower(e.source_id),
               cf.level
    `)) as unknown as {
      caption: string;
      source: string;
      display: string;
      class_source: string;
      class_slug: string;
    }[];

    for (const row of featureRows) {
      found.set(`${row.caption}|${row.source}`, {
        caption: row.caption,
        source: row.source,
        display: row.display,
        slug: null,
        classHref: `/compendium/classes/${row.class_source}/${row.class_slug}`,
      });
    }
  }

  /*
   * Last, a table the books print without a caption. The PHB's tools table is
   * one: `{@table tools|phb}` names it, but the caption lives on the section
   * above it rather than on the table, so neither lookup above can see it. The
   * section is what the reader is sent to, at the anchor `splitSections` gives
   * it — the same function the chapter page renders from, so the two cannot
   * drift apart.
   */
  const stillMissing = targets.filter(
    (target) => !found.has(`${target.caption}|${target.source}`),
  );

  if (stillMissing.length > 0) {
    const captionsLeft = [...new Set(stillMissing.map((t) => t.caption))];

    const chapters = (await db.execute(sql`
      SELECT lower(e.source_id) AS source,
             e.slug             AS slug,
             bs.data->'entries' AS entries
      FROM book_sections bs
      JOIN entities e ON e.id = bs.entity_id
      WHERE lower(e.source_id) = ANY(${sql.param([...new Set(stillMissing.map((t) => t.source))])})
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(bs.data->'entries') top
          WHERE lower(top->>'name') = ANY(${sql.param(captionsLeft)})
        )
    `)) as unknown as { source: string; slug: string; entries: unknown[] }[];

    for (const chapter of chapters) {
      for (const section of splitSections(chapter.entries).sections) {
        const caption = section.title.toLowerCase();
        if (!captionsLeft.includes(caption)) continue;
        if (found.has(`${caption}|${chapter.source}`)) continue;
        // A section only answers for a table tag if it actually holds a table.
        if (!holdsTable(section.entries)) continue;

        found.set(`${caption}|${chapter.source}`, {
          caption,
          source: chapter.source,
          display: section.title,
          slug: chapter.slug,
          anchor: section.id,
          classHref: null,
        });
      }
    }
  }

  return targets.flatMap((target) => {
    const row = found.get(`${target.caption}|${target.source}`);
    if (!row) return [];

    const page = row.classHref ?? `/sources/${row.source}/${row.slug}`;

    return [
      {
        key: target.key,
        name: row.display,
        href: `${page}#${row.anchor ?? tableAnchorId(row.display)}`,
      },
    ];
  });
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
