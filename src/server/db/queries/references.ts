import { inArray } from "drizzle-orm";
import {
  EMPTY_REFERENCES,
  parentKeyFor,
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
