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

export interface InboundReference {
  id: string;
  name: string;
  entityType: EntityType;
  sourceId: string;
  href: string | null;
}

/**
 * What refers to this entity, read from `entity_links`. Fireball has 224
 * inbound references across ten entity types.
 *
 * Fragments are skipped: they need a parent to be addressable, and an
 * unclickable row is no use in a "referenced by" list.
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
