import { inArray, sql } from "drizzle-orm";
import {
  EMPTY_ANCHORS,
  EMPTY_AREAS,
  EMPTY_REFERENCES,
  parentKeyFor,
  type AnchoredIds,
  type AreaIndex,
  type ReferenceIndex,
  type ResolvedReference,
} from "@/lib/content/references";
import { hrefFor, isFragmentType } from "@/lib/routes";
import type { EntityType } from "@/server/db/schema/enums";
import { db } from "../client";
import { entities } from "../schema/entities";

/**
 * Resolves inline cross-references to URLs.
 *
 * Lookup is by natural key against a unique index, never by slugifying the tag
 * text, and references are collected for the whole page and resolved in one
 * round trip rather than one per tag.
 */

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
 * Resolve candidate natural keys to names and URLs. Keys that match nothing are
 * absent from the result, which is normal: an `{@item}` contributes three
 * candidates and only one exists.
 *
 * At most two queries; the second only when a fragment needs its parent.
 */
export async function resolveReferences(
  keys: Iterable<string>,
): Promise<ReferenceIndex> {
  const wanted = [...keys];
  if (wanted.length === 0) return EMPTY_REFERENCES;

  const rows = await fetchByKeys(wanted);

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
 * Ids are only unique within a section — three tags in the whole corpus address
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
