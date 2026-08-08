import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { entities } from "./entities";

/**
 * Chapter-level slices of book and adventure body text. A detail table like
 * `spells` or `monsters`; name, source, page and slug live on the entity.
 *
 * Stored one row per top-level chapter rather than one per book — `book-dmg`
 * alone is 1.3 MB and the reader renders one chapter at a time. Deeper nesting
 * stays inside `data`, which the renderer recurses into.
 */
export const bookSections = pgTable(
  "book_sections",
  {
    entityId: uuid()
      .primaryKey()
      .references(() => entities.id, { onDelete: "cascade" }),
    /**
     * The id of the book this chapter came from. Usually the same as the
     * entity's `source_id`, but not always: an adventure printed inside a
     * rulebook keeps its own id ("MOT-NSS") while belonging to the containing
     * book's source ("MOT").
     *
     * Chapter order is therefore `(book_id, ordinal)`, never `ordinal` alone —
     * a source with two bodies restarts the count.
     */
    bookId: varchar({ length: 32 }).notNull(),
    /**
     * Position within this book's body, 0-based. Also the chapter's identity:
     * `{@book color pools|DMG|2|Color Pools}` addresses a chapter by index, so
     * the natural key is built from this.
     */
    ordinal: integer().notNull(),
    /** "chapter", "appendix", "part", "level", "episode", or null for front matter. */
    ordinalType: varchar({ length: 16 }),
    /** Printed chapter number or appendix letter, as displayed. Some appendices are unnumbered. */
    ordinalLabel: varchar({ length: 8 }),
    /** Flattened heading names, for in-book search and a chapter outline. */
    headers: text().array(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  // No index on the ordering columns: a chapter list filters by source on
  // `entities` and then sorts a couple of dozen rows, so one would never be used.
);

export const bookSectionsRelations = relations(bookSections, ({ one }) => ({
  entity: one(entities, {
    fields: [bookSections.entityId],
    references: [entities.id],
  }),
}));

export type BookSection = typeof bookSections.$inferSelect;
