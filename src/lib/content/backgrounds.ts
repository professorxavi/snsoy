import { titleCase } from "./classes";

/**
 * Backgrounds: what a character did before the first session, and the
 * proficiencies that came with it.
 *
 * Ingest normalised the skill and tool lists into plain `text[]` columns, so
 * nothing here has to read the blob — 96 backgrounds, 18 distinct skills, all
 * lowercase and already spelled the way the skill entities are. That is what
 * makes the skill facet worth having: "which background gives me Stealth" is
 * the question a player actually arrives with.
 */

/** "sleight of hand" → "Sleight of Hand", as the books set it. */
export const proficiencyLabel = titleCase;

/**
 * A proficiency list as one cell.
 *
 * Empty reads as an em dash rather than as nothing: 26 backgrounds grant no
 * tools, and a blank cell there is indistinguishable from a column that failed
 * to load.
 */
export function proficiencySummary(values: string[] | null): string {
  if (!values || values.length === 0) return "—";

  return values.map(proficiencyLabel).join(", ");
}

/**
 * "Two of your choice", for the language column.
 *
 * The count is what ingest kept; the books phrase it as a number of free
 * choices rather than as named languages, and 67 of the 96 backgrounds carry
 * one.
 */
export function languageSummary(count: number | null): string {
  if (!count) return "—";

  return count === 1 ? "One of your choice" : `${WORDS[count] ?? count} of your choice`;
}

const WORDS: Record<number, string> = { 1: "One", 2: "Two", 3: "Three", 4: "Four" };
