/**
 * Sense display helpers.
 *
 * A sense is a `generic_entities` row with nothing typed about it: a name and a
 * paragraph saying what a creature with it can perceive. There is nothing to
 * sort or filter on, which is why the list is alphabetical and the only thing
 * here is the summary line.
 */

/**
 * One line on what each sense lets a creature perceive, in our words rather
 * than the book's.
 *
 * A sense opens by describing the creature that has it rather than the sense
 * itself — Darkvision spends its first clause on who dwells underground, and
 * Blindsight on oozes and bats — so the line below is written from the whole
 * paragraph rather than lifted off the top of it. Four senses account for
 * nearly every "how does it see me" question at a table, and this is what lets
 * the list answer that without opening all four.
 *
 * Keyed by slug. Safe here despite two books being involved — the Monster
 * Manual defines tremorsense and the Player's Handbook the other three, and no
 * two of the four share a slug. It would not be safe for a type where they do:
 * 40 of the 135 languages share a slug with a language from another book, which
 * is why that list carries typed columns off the blob instead of a map like
 * this one.
 */
const COVERS: Record<string, string> = {
  blindsight: "Perceives without sight, out to a radius.",
  darkvision: "Sees in darkness, in shades of grey.",
  tremorsense: "Feels vibrations through shared ground.",
  truesight: "Sees through darkness, illusion and disguise.",
};

/** Null for anything unsummarised, so the cell is left empty rather than wrong. */
export function senseCovers(slug: string): string | null {
  return COVERS[slug] ?? null;
}
