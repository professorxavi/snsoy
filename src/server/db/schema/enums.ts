import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Every content type we ingest.
 *
 * Names match the top-level array keys in the source JSON so ingest can map
 * file -> type without a translation table. Types without a dedicated detail
 * table land in `generic_entities`.
 *
 * Excluded on purpose: generator inputs (name lists, random-life tables, loot
 * tables, homebrew-editor scaffolding), which load into `support_data` instead.
 */
export const entityTypeEnum = pgEnum("entity_type", [
  // Typed detail tables
  "spell",
  "monster",
  "item",
  "baseitem",
  "itemGroup",
  "magicvariant",
  "race",
  "subrace",
  "background",
  "feat",
  "class",
  "subclass",
  "classFeature",
  "subclassFeature",
  "optionalfeature",
  /**
   * A top-level chapter of a book or adventure. Not an upstream array key like
   * the rest — body text ships one file per source — but chapters are entities
   * for the same reasons everything else is: searched, linked to by `{@book}`
   * and `{@adventure}`, and gated by the source that printed them.
   */
  "bookSection",
  // generic_entities
  "action",
  "boon",
  "card",
  "charoption",
  "condition",
  "cult",
  "deck",
  "deity",
  "disease",
  "hazard",
  "language",
  "object",
  "psionic",
  "raceFeature",
  "recipe",
  "reward",
  "sense",
  "skill",
  "status",
  "table",
  "trap",
  "variantrule",
  "vehicle",
  "vehicleUpgrade",
]);

export type EntityType = (typeof entityTypeEnum.enumValues)[number];

/**
 * How a user came to own a source. `provider` rows are replaced wholesale on
 * each sync; `manual` rows are user-controlled and survive syncs.
 */
export const grantedViaEnum = pgEnum("granted_via", ["provider", "manual"]);

export const syncStatusEnum = pgEnum("sync_status", [
  "pending",
  "success",
  "failed",
]);

/**
 * Lookup data the renderer needs but users never browse: item property
 * abbreviations, monster legendary groups, and the like.
 */
export const supportKindEnum = pgEnum("support_kind", [
  "itemProperty",
  "itemType",
  "itemEntry",
  "itemTypeAdditionalEntries",
  "legendaryGroup",
  "monsterTemplate",
  "magicVariant",
]);
