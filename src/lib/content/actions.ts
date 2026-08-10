/**
 * Action display helpers.
 *
 * An action is a `generic_entities` row carrying one typed-ish field — how long
 * it takes — and a paragraph or two of rules text.
 */

/**
 * How long an action takes, from the blob's `time` array.
 *
 * Entries are either `{unit, number}` or a bare string the book wrote itself,
 * which is where "Varies" and "Free" come from. An action can carry two —
 * Identify a Spell is a reaction *or* an action — and the choice is the whole
 * rule, so both are printed.
 */
export function actionTimeLabel(times: unknown): string | null {
  if (!Array.isArray(times)) return null;

  const labels = (times as (string | { unit?: string })[]).map((time) =>
    typeof time === "string" ? time : UNITS[time.unit ?? ""] ?? time.unit ?? "",
  );

  // "Action or Bonus Action", the way the books write a choice of two.
  return labels.filter(Boolean).join(" or ") || null;
}

/**
 * The same, from the JSON text a list row carries.
 *
 * A list can only project `data->>'time'`, and `time` is an array — so what
 * reaches a table cell is the array's own JSON. The aside has the parsed blob
 * already and calls `actionTimeLabel` directly; this is the round trip that
 * saves widening the field map for one type.
 */
export function actionTime(raw: string | null | undefined): string | null {
  if (!raw) return null;

  return actionTimeLabel(JSON.parse(raw));
}

const UNITS: Record<string, string> = {
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
  free: "Free",
};

/**
 * One line on what each action does, in our words rather than the book's.
 *
 * The books open an action with scene-setting rather than with the rule —
 * Opportunity Attack spends its first sentence on everyone watching for enemies
 * to drop their guard, and Ready on wanting to get the jump on a foe. So the
 * lines below are written from the whole entry, and say the part a player needs
 * before deciding to read the rest.
 *
 * Keyed by slug. Three books define actions and no two of the thirty share a
 * slug, so there is no second Shove to collide with.
 */
const DOES: Record<string, string> = {
  "activate-an-item": "Command word, scroll or draught — using a magic item.",
  attack: "Swing, shoot or brawl. The commonest action there is.",
  "cast-a-spell": "Cast a spell in combat, for whatever its time costs.",
  "climb-onto-a-bigger-creature": "Grapple your way onto something far larger.",
  dash: "Move again, up to your speed.",
  disarm: "A contest to knock a weapon out of a grasp.",
  disengage: "Move away without provoking opportunity attacks.",
  dodge: "Attacks against you have disadvantage.",
  "don-or-doff-a-shield": "Strap on or drop a shield.",
  "end-concentration": "Let go of a spell you were holding, at will.",
  "escape-a-grapple": "Contest Athletics or Acrobatics to break free.",
  grapple: "A special melee attack to seize and hold.",
  "healing-surge": "Spend up to half your Hit Dice, mid-adventure.",
  help: "Give an ally advantage on a check or an attack.",
  hide: "A Stealth check to go unseen.",
  "identify-a-spell": "Name a spell as it is cast, or after the fact.",
  "improvising-an-action": "Anything the rules did not think of.",
  mark: "Harry a foe so it cannot easily leave your reach.",
  "opportunity-attack": "Strike a foe that moves out of your reach.",
  "other-activity": "Flourishes costing neither your action nor your move.",
  overrun: "Force your way through a hostile creature's space.",
  ready: "Set a trigger now, act on your reaction later.",
  search: "Look for something, by Perception or Investigation.",
  shove: "Knock a creature prone, or push it away from you.",
  "shove-aside": "Push a foe sideways instead of away, at disadvantage.",
  "stabilize-a-creature": "First aid on the dying: a DC 10 Medicine check.",
  tumble: "Acrobatics to slip through a hostile creature's space.",
  "two-weapon-fighting": "A bonus-action swing with your other light weapon.",
  "use-an-object": "Interact with something that needs your whole action.",
  "waking-someone": "Shake or slap a natural sleeper awake.",
};

/** Null for anything unsummarised, so the cell is left empty rather than wrong. */
export function actionDoes(slug: string): string | null {
  return DOES[slug] ?? null;
}
