/**
 * Status display helpers.
 *
 * A status is a `generic_entities` row with nothing typed about it. There are
 * two of them, both from the Player's Handbook, and they exist as their own type
 * rather than as conditions because the rules treat them differently — nothing
 * grants or removes concentration the way a spell grants a condition.
 */

/**
 * One line on what each status means, in our words rather than the book's.
 *
 * Neither opens by saying what it is. Concentration opens on the spells that
 * require it, and Surprised on a band of adventurers in the trees — so the
 * lines below are written from the whole entry rather than lifted off the top.
 *
 * Keyed by slug, which is safe here for the same reason it is for conditions:
 * both come from one book, so there is no second Concentration to collide with.
 */
const MEANS: Record<string, string> = {
  concentration: "Holding a spell active, and what breaks it.",
  surprised: "Caught unready: no move or action on the first turn.",
};

/** Null for anything unsummarised, so the cell is left empty rather than wrong. */
export function statusMeans(slug: string): string | null {
  return MEANS[slug] ?? null;
}
