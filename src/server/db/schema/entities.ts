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
  varchar,
} from "drizzle-orm/pg-core";
import { entityTypeEnum } from "./enums";
import { sources } from "./sources";

/** Postgres `tsvector`. Drizzle has no first-class type for it. */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});

/**
 * The universal entity registry — every ingested entity gets a row here, with
 * no exceptions, regardless of which detail table holds its typed columns.
 *
 * Having one registry is what lets cross-reference resolution, omnisearch, and
 * entitlement gating each be written once instead of once per content type.
 */
export const entities = pgTable(
  "entities",
  {
    /**
     * Corpus identity: lowercased `name|source`, e.g. "fireball|phb".
     *
     * Some types need more parts to be unique — a class feature is
     * `name|className|classSource|level|source`. Build these with
     * `makeUid()` from `@/lib/content/uid` rather than by hand; the format has
     * to match what cross-reference tags encode or links will not resolve.
     */
    uid: text().primaryKey(),
    entityType: entityTypeEnum().notNull(),
    name: text().notNull(),
    /**
     * When the corpus sets `srd` to a string rather than `true`, the SRD
     * release publishes this entity under a different name (trademarked
     * creatures, mostly). SRD-only builds must display this instead of `name`.
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
     * Supplementary lore and artwork from the corpus `*Fluff` arrays, merged
     * in at ingest so the renderer needs a single fetch.
     */
    fluff: jsonb().$type<unknown>(),
  },
  (table) => [
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
 * Resolving these up front rather than at render time means a page can
 * prefetch what it links to, "what references this spell?" is a plain query,
 * and broken references surface as an ingest assertion instead of a dead link
 * discovered by a user.
 */
export const entityLinks = pgTable(
  "entity_links",
  {
    fromUid: text()
      .notNull()
      .references(() => entities.uid, { onDelete: "cascade" }),
    toUid: text()
      .notNull()
      .references(() => entities.uid, { onDelete: "cascade" }),
    /** The originating tag: "spell", "item", "creature", "condition"... */
    tagType: varchar({ length: 32 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.fromUid, table.toUid, table.tagType] }),
    index().on(table.toUid),
  ],
);

export const entityLinksRelations = relations(entityLinks, ({ one }) => ({
  from: one(entities, {
    fields: [entityLinks.fromUid],
    references: [entities.uid],
    relationName: "linksOut",
  }),
  to: one(entities, {
    fields: [entityLinks.toUid],
    references: [entities.uid],
    relationName: "linksIn",
  }),
}));

/**
 * Denormalised omnisearch target. Rebuilt by the ingest pipeline.
 *
 * Type, source, and SRD flag are copied here rather than joined so a search
 * query can filter by entitlement without touching `entities` at all.
 */
export const searchIndex = pgTable(
  "search_index",
  {
    uid: text()
      .primaryKey()
      .references(() => entities.uid, { onDelete: "cascade" }),
    name: text().notNull(),
    entityType: entityTypeEnum().notNull(),
    sourceId: varchar({ length: 32 }).notNull(),
    isSrd: boolean().notNull().default(false),
    /** Name weighted 'A', body text 'B', so name matches outrank body hits. */
    tsv: tsvector().notNull(),
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
