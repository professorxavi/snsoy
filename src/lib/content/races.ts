/**
 * Race display formatters. The source data is machine-shaped — a size is a
 * letter code, a speed is a number or an object, an ability bonus may be a
 * choice rather than a number — so each of these turns one field into the text
 * a player expects to read.
 */

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

export interface AbilityChoice {
  from?: string[];
  count?: number;
  amount?: number;
  /**
   * Different amounts to different abilities in one spread — "+2 to one and +1
   * to another". `count` and `amount` cannot say that: they describe one amount
   * repeated, so the pair the Tasha's-era races use needs its own shape.
   */
  weighted?: { from: string[]; weights: number[] };
}

/** Fixed bonuses keyed by ability, plus an optional choice. */
export type AbilityBonus = Record<
  string,
  number | AbilityChoice | undefined
> & {
  choose?: AbilityChoice;
};

/** A number is walking speed; an object may also carry fly, swim, climb, burrow. */
export type RaceSpeed = number | Record<string, number | boolean | undefined>;

/* ------------------------------------------------------------------ *
 * Size
 * ------------------------------------------------------------------ */

const SIZES: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan",
  V: "Varies",
};

/** "Medium", or "Small or Medium" for the races that let you pick. */
export function formatSize(size: string[] | null | undefined): string {
  if (!size?.length) return "—";
  const names = size.map((code) => SIZES[code] ?? code);
  return names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/* ------------------------------------------------------------------ *
 * Speed
 * ------------------------------------------------------------------ */

/** Walking is unlabelled; every other mode is named, as the books print them. */
const SPEED_ORDER = ["walk", "burrow", "climb", "fly", "swim"];

/**
 * "30 ft.", or "25 ft., fly 50 ft., swim 25 ft."
 *
 * A mode's value may be `true` rather than a number, meaning "equal to your
 * walking speed". Treating that as a plain boolean drops a winged race's flight.
 */
export function formatSpeed(speed: RaceSpeed | null | undefined): string {
  if (speed == null) return "—";
  if (typeof speed === "number") return `${speed} ft.`;

  const walk = typeof speed.walk === "number" ? speed.walk : undefined;

  const parts: string[] = [];
  for (const mode of SPEED_ORDER) {
    const value = speed[mode];
    if (value == null || value === false) continue;

    // `true` means "same as walking".
    const feet =
      value === true ? walk : typeof value === "number" ? value : undefined;
    if (feet == null) continue;

    parts.push(mode === "walk" ? `${feet} ft.` : `${mode} ${feet} ft.`);
  }

  return parts.length > 0 ? parts.join(", ") : "—";
}

/** Just the walking speed, for a list row that has no room for the rest. */
export function walkingSpeed(
  speed: RaceSpeed | null | undefined,
): number | null {
  if (speed == null) return null;
  if (typeof speed === "number") return speed;
  return typeof speed.walk === "number" ? speed.walk : null;
}

/* ------------------------------------------------------------------ *
 * Ability bonuses
 * ------------------------------------------------------------------ */

const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"];

const ABILITY_LABELS: Record<string, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

const COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six"];

function formatChoice(choice: AbilityChoice): string {
  if (choice.weighted) return formatWeighted(choice.weighted);

  const from = choice.from ?? [];
  const amount = choice.amount ?? 1;
  const count = choice.count ?? 1;

  // A choice from all six reads as "your choice"; a narrower one names them.
  const isOpen = from.length >= ABILITY_ORDER.length;
  if (isOpen) {
    return `${signed(amount)} to ${COUNT_WORDS[count] ?? count} of your choice`;
  }

  const options = [...from]
    .sort((a, b) => ABILITY_ORDER.indexOf(a) - ABILITY_ORDER.indexOf(b))
    .map((key) => ABILITY_LABELS[key] ?? key.toUpperCase());

  const list =
    options.length === 1
      ? options[0]
      : `${options.slice(0, -1).join(", ")} or ${options[options.length - 1]}`;

  return count > 1
    ? `${signed(amount)} to ${COUNT_WORDS[count] ?? count} of ${list}`
    : `${signed(amount)} to ${list}`;
}

/**
 * "+1 to three of your choice", or "+2 and +1 to two different abilities of
 * your choice".
 *
 * One amount repeated is the ordinary choice and reads as one — three ones are
 * "+1 to three". Mixed amounts have to be named individually, because which
 * ability gets the 2 is the decision being described.
 */
function formatWeighted(weighted: {
  from: string[];
  weights: number[];
}): string {
  const weights = weighted.weights ?? [];
  if (weights.length === 0) return "";

  const uniform = weights.every((weight) => weight === weights[0]);
  if (uniform) {
    return formatChoice({
      from: weighted.from,
      count: weights.length,
      amount: weights[0],
    });
  }

  const amounts = weights.map(signed);
  const list = `${amounts.slice(0, -1).join(", ")} and ${amounts[amounts.length - 1]}`;
  const count = COUNT_WORDS[weights.length] ?? weights.length;

  // "to two of your choice" already means two different ones, and this line
  // shares a row with a size and a speed.
  return `${list} to ${count} of your choice`;
}

function formatOne(bonus: AbilityBonus): string {
  const fixed: string[] = [];

  for (const key of ABILITY_ORDER) {
    const value = bonus[key];
    if (typeof value === "number" && value !== 0) {
      fixed.push(`${signed(value)} ${ABILITY_LABELS[key]}`);
    }
  }

  if (bonus.choose) fixed.push(formatChoice(bonus.choose));
  return fixed.join(", ");
}

/**
 * "+2 CON", "+2 DEX, +1 WIS", "+2 to one of your choice".
 *
 * The outer array is a list of alternatives, not a set to sum: a few races
 * offer a whole second spread, so entries join with "or".
 */
export function formatAbilityBonuses(
  ability: AbilityBonus[] | null | undefined,
): string {
  if (!ability?.length) return "—";

  const spreads = ability.map(formatOne).filter(Boolean);
  return spreads.length > 0 ? spreads.join(" or ") : "—";
}

/* ------------------------------------------------------------------ *
 * Lineage
 * ------------------------------------------------------------------ */

/**
 * The spread every race printed after *Tasha's* uses instead of a fixed one.
 *
 * From *Van Richten's* onwards a race stops dictating which abilities it
 * raises and defers to the player: two ability scores or three, chosen freely.
 * The books print that rule once and mark each race that follows it with
 * `lineage`, so the race's own entry carries no `ability` at all — 46 of them,
 * across seven books, and every one of them showed no ability line whatsoever.
 *
 * Two alternatives, which is what the outer array means: the reader picks one.
 */
export const LINEAGE_ABILITY: AbilityBonus[] = [
  { choose: { weighted: { from: ABILITY_ORDER, weights: [2, 1] } } },
  { choose: { weighted: { from: ABILITY_ORDER, weights: [1, 1, 1] } } },
];

/** A race whose ability spread may be the lineage rule rather than its own. */
interface MaybeLineage {
  ability?: AbilityBonus[] | null;
  /**
   * Which lineage rule the race follows. `"VRGR"` is the one the books use;
   * `true` is a filter marker on the one race that also states its own spread,
   * so it is not a substitution.
   */
  lineage?: string | null;
}

/**
 * What a race actually offers, its own spread or the lineage rule.
 *
 * Its own always wins. A handful of lineage races do state a spread, and the
 * rule is the default they fall back on rather than a replacement.
 */
export function abilitySpreads(race: MaybeLineage): AbilityBonus[] | null {
  if (race.ability?.length) return race.ability;
  return race.lineage === "VRGR" ? LINEAGE_ABILITY : null;
}

/**
 * The languages a lineage race grants, printed once in the books alongside the
 * ability rule and left off every race that follows it.
 *
 * Shaped as a named entry because that is what it is on every other race — the
 * last of the traits, after Darkvision and the rest — so it reads, anchors and
 * outlines like the Languages trait a reader already knows.
 */
export const LINEAGE_LANGUAGES = {
  type: "entries",
  name: "Languages",
  entries: [
    "You can speak, read, and write Common and one other language that you and your DM agree is appropriate for your character.",
  ],
};

/**
 * A race's traits, with the languages a lineage race is owed.
 *
 * None of the 46 state one of their own, but the check is on the trait rather
 * than on the count: a book that starts printing it would otherwise get two.
 */
export function raceTraits<E>(
  entries: E[] | undefined,
  lineage: string | null | undefined,
): E[] {
  const traits = entries ?? [];
  if (lineage !== "VRGR") return traits;

  const named = traits.some(
    (trait) => (trait as { name?: unknown } | null)?.name === "Languages",
  );

  return named ? traits : [...traits, LINEAGE_LANGUAGES as E];
}

/* ------------------------------------------------------------------ *
 * NPC races
 * ------------------------------------------------------------------ */

/**
 * Marks a race printed as an NPC option rather than a playable one.
 *
 * The tag is the only reliable test — filtering by source would be wrong, since
 * the DMG prints both these and genuine player options like Aasimar.
 */
export const NPC_RACE_TAG = "NPC Race";

export function isNpcRace(traitTags: string[] | null | undefined): boolean {
  return traitTags?.includes(NPC_RACE_TAG) ?? false;
}

/* ------------------------------------------------------------------ *
 * Description
 * ------------------------------------------------------------------ */

/**
 * A race's descriptive prose, wherever the books happen to keep it.
 *
 * Fluff first, because that is where nearly all of it is: of the 134 races,
 * 98 carry prose only in fluff, 5 carry it in `data.entries`, and 31 have none
 * at all. Reading `data.entries` alone — which is what a class does, since a
 * class's own entries are the progression its table prints — would leave the
 * great majority of races with nothing to say for themselves.
 *
 * Returns everything, named sections included; the caller splits off the
 * opening prose it wants.
 */
export function descriptionEntries<T>(fluff: unknown, data: unknown): T[] {
  const fromFluff = entriesOf<T>(fluff);
  return fromFluff.length > 0 ? fromFluff : entriesOf<T>(data);
}

/** The `entries` of a fluff or data blob, or nothing if it has none. */
export function entriesOf<T>(value: unknown): T[] {
  const entries = (value as { entries?: unknown[] } | null)?.entries;
  return Array.isArray(entries) ? (entries as T[]) : [];
}
