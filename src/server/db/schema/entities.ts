import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { entityTypeEnum } from "./enums";
import { sources } from "./sources";

/** Postgres `tsvector`. Drizzle has no first-class type for it. */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});

/**
 * The universal entity registry: every ingested entity gets a row here,
 * whichever detail table holds its typed columns. One registry means
 * cross-reference resolution, search, and entitlement gating are each written
 * once rather than once per content type.
 */
export const entities = pgTable(
  "entities",
  {
    id: uuid().primaryKey().defaultRandom(),

    /**
     * The upstream identity for this entity: `type|name|source`, lowercased —
     * `spell|fireball|phb`. Unique and indexed because it is what
     * cross-reference tags encode, and what re-seeding upserts on so ids
     * survive data updates.
     *
     * Some types need more parts to be unique (a class feature is
     * `classfeature|name|class|classSource|level|source`). Build these with
     * `naturalKeyFor()` from `@/lib/content/identity` — the format must match
     * what tags encode or links will not resolve.
     */
    naturalKey: text().notNull(),

    entityType: entityTypeEnum().notNull(),
    name: text().notNull(),
    /**
     * Set when the SRD publishes this entity under a different name (mostly
     * trademarked creatures). SRD-only builds display this instead of `name`.
     */
    srdName: text(),
    sourceId: varchar({ length: 32 })
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    page: integer(),
    /** URL segment, unique within a source. */
    slug: text().notNull(),
    /** Freely redistributable under the SRD. Drives public visibility. */
    isSrd: boolean().notNull().default(false),
    /** Subset of SRD published in the free Basic Rules. */
    isBasicRules: boolean().notNull().default(false),
    /**
     * Supplementary lore and artwork from the upstream `*Fluff` arrays, merged
     * in at ingest so the renderer needs a single fetch.
     */
    fluff: jsonb().$type<unknown>(),
  },
  (table) => [
    uniqueIndex().on(table.naturalKey),
    uniqueIndex().on(table.entityType, table.sourceId, table.slug),
    index().on(table.entityType),
    index().on(table.sourceId),
    /** Partial index: the public/anonymous view hits this constantly. */
    index()
      .on(table.entityType, table.name)
      .where(sql`${table.isSrd}`),
  ],
);

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  source: one(sources, {
    fields: [entities.sourceId],
    references: [sources.id],
  }),
  linksOut: many(entityLinks, { relationName: "linksOut" }),
  linksIn: many(entityLinks, { relationName: "linksIn" }),
}));

/**
 * Cross-references extracted from `{@tag}` markup at ingest time.
 *
 * Resolving these up front makes "what references this spell?" a plain query,
 * and surfaces broken references at ingest instead of as dead links in the UI.
 */
export const entityLinks = pgTable(
  "entity_links",
  {
    fromId: uuid()
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    toId: uuid()
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    /** The originating tag: "spell", "item", "creature", "condition"... */
    tagType: varchar({ length: 32 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.fromId, table.toId, table.tagType] }),
    index().on(table.toId),
  ],
);

export const entityLinksRelations = relations(entityLinks, ({ one }) => ({
  from: one(entities, {
    fields: [entityLinks.fromId],
    references: [entities.id],
    relationName: "linksOut",
  }),
  to: one(entities, {
    fields: [entityLinks.toId],
    references: [entities.id],
    relationName: "linksIn",
  }),
}));

/**
 * Denormalised full-text search target, rebuilt by the ingest pipeline. Type,
 * source and SRD flag are copied rather than joined so a search query can
 * filter by entitlement without touching `entities`.
 */
export const searchIndex = pgTable(
  "search_index",
  {
    entityId: uuid()
      .primaryKey()
      .references(() => entities.id, { onDelete: "cascade" }),
    name: text().notNull(),
    entityType: entityTypeEnum().notNull(),
    sourceId: varchar({ length: 32 }).notNull(),
    isSrd: boolean().notNull().default(false),
    /**
     * The entity's prose, flattened and stripped of markup at ingest so a
     * search for "fireball" matches text that mentions it.
     */
    body: text(),
    /**
     * Generated rather than populated, so it cannot drift from the columns it
     * summarises. Name is weighted 'A' and body 'B', so an entity named
     * "Fireball" outranks the ones that merely mention it.
     */
    tsv: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(name, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')`,
    ),
  },
  (table) => [
    index().using("gin", table.tsv),
    index("search_index_name_trgm_idx").using(
      "gin",
      sql`${table.name} gin_trgm_ops`,
    ),
    index().on(table.entityType, table.sourceId),
  ],
);

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type EntityLink = typeof entityLinks.$inferSelect;
