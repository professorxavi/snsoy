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
  magicvariant: "magic-variants",
  race: "races",
  background: "backgrounds",
  feat: "feats",
  class: "classes",
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
 *
 * A subclass is one of these rather than a browsable type. Every one of them is
 * printed on its class's page — there is no such thing as reading a Battle
 * Master without the Fighter around it — and a route of its own would be a
 * second place to find the same text, reachable from an index nobody wants.
 */
const FRAGMENT_TYPES = new Set<EntityType>([
  "subrace",
  "subclass",
  "classFeature",
  "subclassFeature",
]);

export function isBrowsable(type: EntityType): type is BrowsableType {
  return type in SEGMENTS;
}

export function isFragmentType(type: EntityType): boolean {
  return FRAGMENT_TYPES.has(type);
}

/**
 * Types with a detail route of their own, under `[source]/[slug]`.
 *
 * Having one is the exception. An address that resolves to no page is the
 * design rather than a gap: `hrefFor` addresses every entity so that a citation
 * in book text is a real anchor — middle-clickable, copyable, crawlable — and
 * the panel opens in place without the URL moving. Opening that anchor cold
 * reaches a 404, and that is the intended destination. A page is granted per
 * type, on the merits, when someone asks for one.
 *
 * This list is what stops the 404's signpost lying. Without it a mistyped slug
 * on a type that *does* have a page — `/compendium/spells/phb/frebal` — is told
 * "Spells have no page of their own. They open in a panel beside their list",
 * which is false in both halves.
 *
 * Hand-listed because `readDeadEnd` runs in a client component and cannot read
 * the filesystem. `routes.test.ts` pins it against the routes that actually
 * exist under `src/app/compendium`, so it fails the moment one is added or
 * removed rather than drifting quietly.
 */
const TYPES_WITH_A_PAGE = new Set<EntityType>([
  "spell",
  "race",
  "class",
  "monster",
]);

/** True when opening this entity's URL cold reaches a page rather than a 404. */
export function hasDetailPage(type: EntityType): boolean {
  return TYPES_WITH_A_PAGE.has(type);
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
 * Returns null when the entity cannot be addressed: a type with no segment, or
 * a fragment with no parent supplied. Callers render plain text in that case.
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

  const segment = segmentFor(entity.entityType);
  if (!segment) return null;

  return `/compendium/${segment}/${entity.sourceId.toLowerCase()}/${entity.slug}`;
}

/** What an entity URL points at. */
export interface ParsedEntityHref {
  type: BrowsableType;
  sourceId: string;
  slug: string;
}

/**
 * Read an entity URL back apart — the inverse of `hrefFor`.
 *
 * Book text is rendered as ordinary anchors, so opening one of them in place
 * means recovering the entity from its href. Kept next to `hrefFor` because the
 * two have to agree about the shape of a URL, and that agreement is easier to
 * keep when breaking it shows up in one file.
 *
 * Returns null for anything that is not a `/compendium/{segment}/{source}/{slug}`
 * URL: a chapter link, an unknown segment, a list URL, an off-site link. A
 * fragment is dropped rather than rejected — a subclass link addresses its
 * class's page and it is the class that opens.
 */
export function parseEntityHref(href: string): ParsedEntityHref | null {
  if (!href.startsWith("/compendium/")) return null;

  const parts = href.split(/[?#]/)[0]!.split("/").filter(Boolean);
  if (parts.length !== 4) return null;

  const type = typeForSegment(parts[1]!);
  if (!type) return null;

  return { type, sourceId: parts[2]!, slug: parts[3]! };
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
