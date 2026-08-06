import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { grantedViaEnum, syncStatusEnum } from "./enums";
import { sources } from "./sources";

export const users = pgTable("users", {
  id: serial().primaryKey(),
  email: text().notNull().unique(),
  displayName: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Audit trail of entitlement syncs against an external account provider.
 *
 * `rawResponse` keeps the provider's payload so a mapping bug can be replayed
 * without asking the user to re-authenticate.
 *
 * The user's credential is NEVER stored — not here, not anywhere. It is used
 * for a single request and discarded. There is no column for it by design; if
 * one ever appears in a diff, that is the bug.
 */
export const entitlementSyncs = pgTable(
  "entitlement_syncs",
  {
    id: serial().primaryKey(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: syncStatusEnum().notNull().default("pending"),
    syncedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Populated on failure so the user sees why, not just that. */
    error: text(),
    rawResponse: jsonb().$type<unknown>(),
    /** Source ids the sync resolved to, before mapping gaps are applied. */
    resolvedSourceIds: text().array(),
    /**
     * Provider source ids with no row in `providerSourceMap`. Non-empty means
     * the mapping table needs a new entry — surfaced as an admin warning
     * rather than silently dropping content the user paid for.
     */
    unmappedProviderIds: text().array(),
  },
  (table) => [index().on(table.userId, table.syncedAt)],
);

/**
 * Which sources a user owns. Rows granted via `provider` are replaced wholesale
 * on each sync; `manual` rows are user-controlled and survive syncs untouched.
 */
export const userEntitlements = pgTable(
  "user_entitlements",
  {
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: varchar({ length: 32 })
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    grantedVia: grantedViaEnum().notNull(),
    grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.sourceId] }),
    index().on(table.userId),
  ],
);

/**
 * Hand-maintained bridge from an external provider's source identifiers to our
 * own source abbreviations. Seeded from a checked-in fixture and extended as
 * the provider adds books; `entitlementSyncs.unmappedProviderIds` reports what
 * is still missing.
 */
export const providerSourceMap = pgTable(
  "provider_source_map",
  {
    providerSourceId: varchar({ length: 32 }).primaryKey(),
    /** The provider's own label, kept for diagnosing mapping mismatches. */
    providerName: text(),
    sourceId: varchar({ length: 32 })
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex().on(table.providerSourceId, table.sourceId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  entitlements: many(userEntitlements),
  syncs: many(entitlementSyncs),
}));

export const userEntitlementsRelations = relations(
  userEntitlements,
  ({ one }) => ({
    user: one(users, {
      fields: [userEntitlements.userId],
      references: [users.id],
    }),
    source: one(sources, {
      fields: [userEntitlements.sourceId],
      references: [sources.id],
    }),
  }),
);

export const entitlementSyncsRelations = relations(
  entitlementSyncs,
  ({ one }) => ({
    user: one(users, {
      fields: [entitlementSyncs.userId],
      references: [users.id],
    }),
  }),
);

export type User = typeof users.$inferSelect;
export type UserEntitlement = typeof userEntitlements.$inferSelect;
export type EntitlementSync = typeof entitlementSyncs.$inferSelect;
