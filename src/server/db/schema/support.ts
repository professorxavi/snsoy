import { index, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { supportKindEnum } from "./enums";

/**
 * Lookup data the renderer depends on but users never browse.
 *
 * Item stat blocks cite property abbreviations ("V", "2H") and type codes
 * ("M", "HA") that only resolve against these tables; legendary groups hold
 * the lair actions shared across a creature family. Modelling them as
 * browsable entities would pollute search results with fragments.
 */
export const supportData = pgTable(
  "support_data",
  {
    kind: supportKindEnum().notNull(),
    /** Abbreviation or `name|source`, depending on kind. */
    key: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.key] }),
    index().on(table.kind),
  ],
);

export type SupportDatum = typeof supportData.$inferSelect;
