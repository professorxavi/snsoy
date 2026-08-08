import type { EntityType } from "@/server/db/schema/enums";

/**
 * URL construction for compendium entities.
 *
 * `entities` is unique on `(entity_type, source_id, slug)`, so a URL carrying
 * all three needs no collision handling. Two rules keep that true: a segment
 * maps to exactly one entity type, and `book_id` never appears in a URL.
 */

/**
 * Entity type to URL segment. Explicit rather than derived from the enum name,
 * so renaming a type does not change its public URL.
 */
const SEGMENTS = {
  spell: "spells",
  monster: "monsters",
  item: "items",
  baseitem: "base-items",
  itemGroup: "item-groups",
  race: "races",
  background: "backgrounds",
  feat: "feats",
  class: "classes",
  subclass: "subclasses",
  optionalfeature: "optional-features",
  action: "actions",
  boon: "boons",
  card: "cards",
  charoption: "character-options",
  condition: "conditions",
  cult: "cults",
  deck: "decks",
  deity: "deities",
  disease: "diseases",
  hazard: "hazards",
  language: "languages",
  object: "objects",
  psionic: "psionics",
  recipe: "recipes",
  reward: "rewards",
  sense: "senses",
  skill: "skills",
  status: "statuses",
  table: "tables",
  trap: "traps",
  variantrule: "variant-rules",
  vehicle: "vehicles",
  vehicleUpgrade: "vehicle-upgrades",
} as const satisfies Partial<Record<EntityType, string>>;

export type BrowsableType = keyof typeof SEGMENTS;

/** Every type with a browse route. The compendium index must cover all of them. */
export const BROWSABLE_TYPES = Object.keys(SEGMENTS) as BrowsableType[];

/**
 * Types with no page of their own. They render as an anchored section of their
 * parent's page instead.
 */
const FRAGMENT_TYPES = new Set<EntityType>([
  "subrace",
  "classFeature",
  "subclassFeature",
]);

/** Types no entity ever has: variants are expanded into `item` at ingest. */
const UNROUTED = new Set<EntityType>(["magicvariant", "raceFeature"]);

export function isBrowsable(type: EntityType): type is BrowsableType {
  return type in SEGMENTS;
}

export function isFragmentType(type: EntityType): boolean {
  return FRAGMENT_TYPES.has(type);
}

/** The URL segment for a browsable type, or null for fragments and non-types. */
export function segmentFor(type: EntityType): string | null {
  return isBrowsable(type) ? SEGMENTS[type] : null;
}

const BY_SEGMENT = new Map<string, BrowsableType>(
  Object.entries(SEGMENTS).map(([type, segment]) => [
    segment,
    type as BrowsableType,
  ]),
);

/** Reverse lookup, for resolving a `[type]` route param back to an enum value. */
export function typeForSegment(segment: string): BrowsableType | null {
  return BY_SEGMENT.get(segment) ?? null;
}

/** The minimum an entity must carry to be addressable. */
export interface Addressable {
  entityType: EntityType;
  sourceId: string;
  slug: string;
}

/**
 * A fragment's parent. Its source may differ from the fragment's — a PHB wizard
 * has TCE subclasses — so it cannot be inferred.
 */
export interface FragmentParent {
  entityType: EntityType;
  sourceId: string;
  slug: string;
}

/**
 * The canonical URL for an entity.
 *
 * Returns null when the entity cannot be addressed: an unrouted type, or a
 * fragment with no parent supplied. Callers render plain text in that case.
 */
export function hrefFor(
  entity: Addressable,
  parent?: FragmentParent,
): string | null {
  if (entity.entityType === "bookSection") {
    return `/sources/${entity.sourceId.toLowerCase()}/${entity.slug}`;
  }

  if (isFragmentType(entity.entityType)) {
    if (!parent) return null;
    const parentHref = hrefFor(parent);
    return parentHref ? `${parentHref}#${entity.slug}` : null;
  }

  if (UNROUTED.has(entity.entityType)) return null;

  const segment = segmentFor(entity.entityType);
  if (!segment) return null;

  return `/compendium/${segment}/${entity.sourceId.toLowerCase()}/${entity.slug}`;
}

/** The browse list for a type, e.g. `/compendium/spells`. */
export function listHrefFor(type: BrowsableType): string {
  return `/compendium/${SEGMENTS[type]}`;
}

export function sourceHref(sourceId: string): string {
  return `/sources/${sourceId.toLowerCase()}`;
}

/**
 * One chapter in the reader. The segment is the section's slug, never its
 * ordinal — ordinals restart when a source carries a second body, and the
 * index form `{@book …|DMG|2|…}` stays internal to the natural key.
 */
export function chapterHref(sourceId: string, slug: string): string {
  return `${sourceHref(sourceId)}/${slug}`;
}
