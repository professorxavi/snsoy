import type { EntityType } from "@/server/db/schema/enums";

/**
 * URL construction for every entity in the corpus.
 *
 * The whole scheme rests on one guarantee: `entities` is unique on
 * `(entity_type, source_id, slug)`, so a URL carrying those three parts is
 * provably unique and needs no collision handling anywhere. Two rules keep that
 * proof valid, and breaking either one silently reintroduces ambiguity:
 *
 * 1. **A segment maps to exactly one entity type.** Merging related types under
 *    a shared segment was measured and rejected — `class` + `subclass` +
 *    features collide 20+ ways inside a single source (PHB `champion` is both a
 *    subclass and its own intro feature). Where a browse view wants to blend
 *    types, it blends them in the *list query* and each row still links to its
 *    own segment.
 * 2. **`book_id` never appears in a URL.** Chapters are addressed by section
 *    slug, which is unique within a source.
 */

/**
 * Entity type to URL segment.
 *
 * Deliberately an explicit table rather than a derivation (pluralise + kebab).
 * It is a translation layer: URLs stay stable and readable while the enum keeps
 * its corpus-derived names, which also keeps the public surface at arm's length
 * from upstream vocabulary. A derivation would leak every rename straight into
 * the URL space.
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
 * Types with no segment of their own, because they render as a fragment of
 * their parent's page.
 *
 * 375 class features, 916 subclass features and 93 subraces would otherwise
 * become ~1,300 pages thin enough to be useless. Inline matches how the printed
 * books read, and it sidesteps the subclass/feature slug collisions above.
 * `optionalfeature` is *not* here on purpose — invocations and maneuvers are
 * genuinely list-and-filter content.
 */
const FRAGMENT_TYPES = new Set<EntityType>([
  "subrace",
  "classFeature",
  "subclassFeature",
]);

/** Types the corpus never yields: variants are expanded into `item` at ingest. */
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
 * A fragment's parent, which the fragment itself cannot supply.
 *
 * A subclass feature's parent may live in a different source than the feature
 * does — a PHB wizard has XGE subclasses — so the parent's own source has to
 * come along rather than being assumed to match.
 */
export interface FragmentParent {
  entityType: EntityType;
  sourceId: string;
  slug: string;
}

/**
 * The canonical URL for an entity. Everything the renderer links to goes
 * through here.
 *
 * Three cases, and there are deliberately only three — any per-type special
 * casing beyond this means one of the two invariants above got broken.
 *
 * Returns null when the entity cannot be addressed: an unrouted type, or a
 * fragment whose parent was not supplied. Callers render plain text rather than
 * a dead link.
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

/** The browse list for a type — `/compendium/spells`. */
export function listHrefFor(type: BrowsableType): string {
  return `/compendium/${SEGMENTS[type]}`;
}

export function sourceHref(sourceId: string): string {
  return `/sources/${sourceId.toLowerCase()}`;
}
