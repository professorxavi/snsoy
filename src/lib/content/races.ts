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
  from: string[];
  count?: number;
  amount?: number;
}

/** Fixed bonuses keyed by ability, plus an optional choice. */
export type AbilityBonus = Record<string, number | AbilityChoice | undefined> & {
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
    const feet = value === true ? walk : typeof value === "number" ? value : undefined;
    if (feet == null) continue;

    parts.push(mode === "walk" ? `${feet} ft.` : `${mode} ${feet} ft.`);
  }

  return parts.length > 0 ? parts.join(", ") : "—";
}

/** Just the walking speed, for a list row that has no room for the rest. */
export function walkingSpeed(speed: RaceSpeed | null | undefined): number | null {
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
  const amount = choice.amount ?? 1;
  const count = choice.count ?? 1;

  // A choice from all six reads as "your choice"; a narrower one names them.
  const isOpen = choice.from.length >= ABILITY_ORDER.length;
  if (isOpen) {
    return `${signed(amount)} to ${COUNT_WORDS[count] ?? count} of your choice`;
  }

  const options = [...choice.from]
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
