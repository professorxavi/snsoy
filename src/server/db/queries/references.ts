import { and, asc, eq, inArray, ne } from "drizzle-orm";
import {
  EMPTY_REFERENCES,
  parentKeyFor,
  type ReferenceIndex,
  type ResolvedReference,
} from "@/lib/content/references";
import { hrefFor, isFragmentType } from "@/lib/routes";
import type { EntityType } from "@/server/db/schema/enums";
import { db } from "../client";
import { entities, entityLinks } from "../schema/entities";

/**
 * Resolving inline cross-references to real URLs.
 *
 * Every `{@spell fireball}` in rendered prose has to become a link, and there
 * are roughly 118,000 of them across the corpus. Two properties make that
 * affordable and correct:
 *
 * - **Lookup is by natural key, against a unique index.** Slugs are derived at
 *   ingest with transformations that cannot be reproduced from a tag's text, so
 *   guessing a URL would produce links that are silently dead.
 * - **One round trip per page, not per tag.** References are collected from the
 *   whole entity first, then resolved together.
 *
 * Checked against `entity_links`, which ingest populated by the same reasoning
 * from the same text: across all 525 spells the two agree exactly, with no link
 * found by one and missed by the other.
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
 * Resolve candidate natural keys to names and URLs.
 *
 * Keys that match nothing are simply absent from the result, and that is the
 * normal case rather than an error — a single `{@item}` contributes three
 * candidates precisely because only one of them will exist. The renderer takes
 * the first candidate present and falls back to the tag's own label when none
 * are, so the sentence still reads correctly either way.
 *
 * Costs at most two queries — the second only when a fragment is referenced,
 * to fetch the parent page the fragment is an anchor on.
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

export interface InboundReference {
  id: string;
  name: string;
  entityType: EntityType;
  sourceId: string;
  href: string | null;
}

/**
 * What refers to this entity.
 *
 * Real content rather than a footnote: Fireball is referred to by 224 other
 * entries spanning ten entity types, and "what else touches this spell" is a
 * question a DM asks constantly. It reads off `entity_links`, which ingest
 * populated by resolving the same `{@tag}` markup this module resolves at
 * render time — so it costs one indexed lookup rather than a scan.
 *
 * Fragments are skipped rather than shown without a destination: they need
 * their parent to be addressable at all, and a "referenced by" list is exactly
 * the place where an unclickable row is worthless.
 */
export async function inboundReferences(
  entityId: string,
): Promise<InboundReference[]> {
  const rows = await db
    .selectDistinct({
      id: entities.id,
      name: entities.name,
      entityType: entities.entityType,
      sourceId: entities.sourceId,
      slug: entities.slug,
    })
    .from(entityLinks)
    .innerJoin(entities, eq(entities.id, entityLinks.fromId))
    .where(and(eq(entityLinks.toId, entityId), ne(entityLinks.fromId, entityId)))
    .orderBy(asc(entities.entityType), asc(entities.name));

  return rows
    .filter((row) => !isFragmentType(row.entityType))
    .map((row) => ({
      id: row.id,
      name: row.name,
      entityType: row.entityType,
      sourceId: row.sourceId,
      href: hrefFor(row),
    }));
}
