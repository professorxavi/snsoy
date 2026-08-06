import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Every content type we ingest from the corpus.
 *
 * Names match the top-level array keys in the source JSON so the ingest
 * pipeline can map file -> type without a translation table. Types listed here
 * but without a dedicated detail table land in `generic_entities`.
 *
 * Deliberately excluded: the corpus also ships generator inputs (name lists,
 * random-life tables, loot tables, homebrew-editor scaffolding) which are tool
 * data rather than browsable content. Those load into `support_data` when
 * needed.
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
 * Lookup blobs the renderer needs but users never browse directly:
 * item property abbreviations, monster legendary groups, and the like.
 */
export const supportKindEnum = pgEnum("support_kind", [
  "itemProperty",
  "itemType",
  "itemEntry",
  "itemTypeAdditionalEntries",
  "legendaryGroup",
  "monsterTemplate",
  "monsterFeature",
]);
