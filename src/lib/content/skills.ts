import { abilityName } from "./dnd";

/**
 * Skill display helpers.
 *
 * A skill carries an ability abbreviation and a paragraph or two of prose, and
 * nothing else worth a typed column — which is why it is a `generic_entities`
 * row. Everything here is pure formatting over that shape.
 */

/** Ability order as a character sheet prints it, rather than alphabetical. */
export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

/**
 * The ability behind a skill, spelled out. Em dash rather than an empty cell
 * for the case the data does not cover, so the column still lines up.
 */
export function abilityLabel(ability: string | null | undefined): string {
  return ability ? abilityName(ability) : "—";
}

/**
 * How the books name a check throughout: "Wisdom (Perception)".
 *
 * Worth printing even directly beneath the skill's own name — it is the form
 * every rules sentence uses, and so the form a reader arriving from one is
 * scanning for.
 */
export function checkName(
  ability: string | null | undefined,
  skill: string,
): string {
  return ability ? `${abilityName(ability)} (${skill})` : skill;
}

/**
 * One line on what each skill is for, in our words rather than the book's.
 *
 * The corpus opens a skill with a sentence far too long for a table cell —
 * Acrobatics runs sixty words before it reaches an example — and a sentence
 * truncated mid-clause reads as a bug rather than as a summary. These exist so
 * that the list answers "which of these do I want" without opening eighteen
 * pages to find out.
 *
 * Keyed by slug, which is safe here in a way it is not generally: every skill
 * comes from one book, so there is no second Perception to collide with.
 */
const COVERS: Record<string, string> = {
  acrobatics: "Balance, tumbling and staying on your feet.",
  "animal-handling": "Calming, driving and reading animals.",
  arcana: "Lore of spells, magic items and the planes.",
  athletics: "Climbing, jumping, swimming and grappling.",
  deception: "Lying convincingly, in word or in act.",
  history: "Lore of past events, kingdoms and old wars.",
  insight: "Reading intentions, and spotting a lie.",
  intimidation: "Threats, menace and open hostility.",
  investigation: "Clues, deduction and searching for detail.",
  medicine: "Stabilising the dying, and diagnosing illness.",
  nature: "Lore of terrain, plants, animals and weather.",
  perception: "Spotting, hearing and noticing what is there.",
  performance: "Music, dance, acting and storytelling.",
  persuasion: "Influence in good faith, with tact or charm.",
  religion: "Lore of gods, rites and holy symbols.",
  "sleight-of-hand": "Palming, planting and manual trickery.",
  stealth: "Hiding, sneaking and slipping past unseen.",
  survival: "Tracking, foraging and reading the wild.",
};

/** Null for anything unsummarised, so the cell is left empty rather than wrong. */
export function skillCovers(slug: string): string | null {
  return COVERS[slug] ?? null;
}
