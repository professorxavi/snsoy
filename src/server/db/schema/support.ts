import { index, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { supportKindEnum } from "./enums";

/**
 * Lookup data the renderer depends on but users never browse: the property
 * abbreviations ("V", "2H") and type codes ("M", "HA") item stat blocks cite,
 * and the lair actions shared across a creature family. Kept out of `entities`
 * so search results are not polluted with fragments.
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
