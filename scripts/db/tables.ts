/**
 * Shared configuration for the seed dump/restore scripts.
 */

/**
 * Content tables, in dependency order.
 *
 * User tables are deliberately excluded. A seed carries content; shipping
 * someone's accounts or entitlements inside one would be a mistake that is
 * very hard to notice after the fact.
 */
export const CONTENT_TABLES = [
  "sources",
  "entities",
  "spells",
  "monsters",
  "items",
  "classes",
  "subclasses",
  "class_features",
  "races",
  "backgrounds",
  "feats",
  "optional_features",
  "generic_entities",
  "support_data",
  "book_sections",
  "entity_links",
  "search_index",
] as const;

export const CONTAINER = process.env.POSTGRES_CONTAINER ?? "snsoy-postgres";
export const DB_USER = process.env.POSTGRES_USER ?? "snsoy";
export const DB_NAME = process.env.POSTGRES_DB ?? "snsoy";
