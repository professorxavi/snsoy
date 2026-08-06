import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { entities } from "./entities";

/**
 * Books and adventures. The unit of entitlement — owning a source unlocks
 * every non-SRD entity that cites it.
 *
 * The primary key is the corpus abbreviation ("PHB", "XGE", "TftYP-ToH")
 * rather than a surrogate id: it is stable, human-readable, and is the value
 * embedded in every cross-reference tag in the corpus.
 */
export const sources = pgTable(
  "sources",
  {
    id: varchar({ length: 32 }).primaryKey(),
    name: text().notNull(),
    /** "core", "supplement", "setting", "adventure"... */
    group: varchar({ length: 32 }),
    published: varchar({ length: 10 }),
    author: text(),
    coverPath: text(),
    /** Adventures render through the same reader but list separately. */
    isAdventure: boolean().notNull().default(false),
    /** Chapter/appendix outline, used to build reader navigation. */
    contents: jsonb().$type<unknown[]>(),
    /** Ordering hint for source lists; lower sorts first. */
    sortOrder: integer().notNull().default(0),
  },
  (table) => [index().on(table.isAdventure), index().on(table.group)],
);

export const sourcesRelations = relations(sources, ({ many }) => ({
  entities: many(entities),
}));

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
