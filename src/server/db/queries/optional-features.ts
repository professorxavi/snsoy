import { arrayOverlaps, asc, eq, inArray, type SQL } from "drizzle-orm";
import {
  formatPrerequisites,
  type OptionalFeatureIndex,
} from "@/lib/content/optional-features";
import { db } from "../client";
import { optionalFeatures } from "../schema/content";
import { entities } from "../schema/entities";
import { sources } from "../schema/sources";

/**
 * Loading the options a class's features tell you to choose between.
 *
 * Two ways in, because the corpus offers two. A feature that names its options
 * ("choose one of the following") is read by key; one that only says a list
 * exists — every invocation, maneuver and infusion — is read by the feature-type
 * codes on the class's progression. Both land in the same index, so the
 * renderer never has to know which way an option arrived.
 */

export type OptionalFeatureRow = Awaited<
  ReturnType<typeof listOptionalFeaturesByKey>
>[number];

function selectOptionalFeatures(where: SQL) {
  return db
    .select({
      naturalKey: entities.naturalKey,
      name: entities.name,
      sourceId: entities.sourceId,
      sourceName: sources.name,
      page: entities.page,
      featureTypes: optionalFeatures.featureTypes,
      prerequisites: optionalFeatures.prerequisites,
      data: optionalFeatures.data,
    })
    .from(optionalFeatures)
    .innerJoin(entities, eq(entities.id, optionalFeatures.entityId))
    .innerJoin(sources, eq(sources.id, entities.sourceId))
    .where(where)
    .orderBy(asc(entities.name));
}

/** Options a feature names, addressed by natural key. */
export async function listOptionalFeaturesByKey(keys: string[]) {
  if (keys.length === 0) return [];
  return selectOptionalFeatures(inArray(entities.naturalKey, keys));
}

/**
 * Every option of a kind — "EI" is all 54 eldritch invocations. Overlap rather
 * than containment, so an option carrying both `FS:F` and `FS:R` is found by
 * either; it is the same index the spell filters use.
 */
export async function listOptionalFeaturesByType(types: string[]) {
  if (types.length === 0) return [];
  return selectOptionalFeatures(arrayOverlaps(optionalFeatures.featureTypes, types));
}

/** Rows into the index the renderer reads. */
export function indexOptionalFeatures(
  rows: OptionalFeatureRow[],
): OptionalFeatureIndex {
  const index: OptionalFeatureIndex = {};

  for (const row of rows) {
    index[row.naturalKey] = {
      name: row.name,
      prerequisite: formatPrerequisites(row.prerequisites),
      entries: (row.data as { entries?: unknown[] }).entries,
      sourceId: row.sourceId,
      sourceName: row.sourceName,
    };
  }

  return index;
}
