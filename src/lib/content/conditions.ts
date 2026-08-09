/**
 * Condition display helpers.
 *
 * A condition is a `generic_entities` row with nothing typed about it: a name
 * and a list of effects. There is no facet to sort or filter on, which is why
 * the list is alphabetical and the only thing here is the summary line.
 */

/**
 * One line on what each condition does to you, in our words rather than the
 * book's.
 *
 * A condition is a list of consequences, not a description — the first bullet
 * of Petrified runs to forty words about weight and ageing, and the bullet that
 * actually matters at the table is the third. So the line below is written from
 * the whole list rather than lifted off the top of it, and says the part a
 * player needs before deciding to read the rest.
 *
 * Keyed by slug, which is safe here in a way it is not generally: all fifteen
 * conditions come from one book, so there is no second Prone to collide with.
 */
const EFFECTS: Record<string, string> = {
  blinded: "Can't see, and fails any check that needs sight.",
  charmed: "Can't harm the charmer, who charms you easily.",
  deafened: "Can't hear, and fails any check that needs hearing.",
  exhaustion: "Six levels, worsening from disadvantage to death.",
  frightened: "Disadvantage in sight of it, and can't approach.",
  grappled: "Speed becomes 0 until the grapple ends.",
  incapacitated: "No actions and no reactions.",
  invisible: "Unseen: it attacks with advantage, you with less.",
  paralyzed: "Helpless, and hit critically from close by.",
  petrified: "Stone: unaware, resistant, and no longer ageing.",
  poisoned: "Disadvantage on attack rolls and ability checks.",
  prone: "Crawling only, and attacking at disadvantage.",
  restrained: "Speed 0, and disadvantage on Dexterity saves.",
  stunned: "No actions, no movement, barely any speech.",
  unconscious: "Out cold and prone, hit critically from close by.",
};

/** Null for anything unsummarised, so the cell is left empty rather than wrong. */
export function conditionEffect(slug: string): string | null {
  return EFFECTS[slug] ?? null;
}
