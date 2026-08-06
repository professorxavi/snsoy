import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sources } from "./sources";

/**
 * Chapter-level slices of book and adventure body text.
 *
 * Stored per top-level section rather than as one blob per book: `book-dmg`
 * alone is 1.3 MB, and the reader only ever renders one chapter at a time.
 * Deeper nesting stays inside `data` — the renderer handles recursion, so
 * splitting further would buy nothing.
 */
export const bookSections = pgTable(
  "book_sections",
  {
    id: serial().primaryKey(),
    sourceId: varchar({ length: 32 })
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    /** Position within the book; drives prev/next navigation. */
    ordinal: integer().notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    /** "chapter", "appendix", or null for unnumbered front/back matter. */
    ordinalType: varchar({ length: 16 }),
    /** Printed chapter number or appendix letter, as displayed. */
    ordinalLabel: varchar({ length: 8 }),
    /** Flattened heading names, for in-book search and a chapter outline. */
    headers: text().array(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    uniqueIndex().on(table.sourceId, table.slug),
    index().on(table.sourceId, table.ordinal),
  ],
);

export const bookSectionsRelations = relations(bookSections, ({ one }) => ({
  source: one(sources, {
    fields: [bookSections.sourceId],
    references: [sources.id],
  }),
}));

export type BookSection = typeof bookSections.$inferSelect;
