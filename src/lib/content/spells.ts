/**
 * Spell display.
 *
 * The corpus stores spells for a rules engine, not for a reader: a school is a
 * single letter, a range is a nested object, a duration is an array. These turn
 * that back into the strings a player expects to see on a spell card.
 *
 * Everything here reads the **original `data` object** rather than the typed
 * columns beside it, and that is deliberate. The typed columns exist to filter
 * and sort — `level`, `school`, `range_feet` are indexed for exactly that — but
 * they are lossy by design. `range_feet` is null for every spell whose range is
 * not measured in feet, which is Touch, Self, Sight and Unlimited: 136 of the
 * Player's Handbook's 361 spells. A Range column built from it alone is blank
 * for more than a third of the book.
 */

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

export interface SpellDistance {
  type: string;
  amount?: number;
}

export interface SpellRange {
  /** "point", or an area shape: "radius", "cone", "line", "sphere", "cube". */
  type: string;
  distance?: SpellDistance;
}

export interface SpellTime {
  number: number;
  /** "action", "bonus", "reaction", "minute", "hour". */
  unit: string;
  /** Present on reactions: what you are reacting to. */
  condition?: string;
}

export interface SpellDurationValue {
  type: string;
  amount: number;
  /** "up to 1 minute" — the caster may end it early. */
  upTo?: boolean;
}

export interface SpellDuration {
  /** "timed", "instant", "permanent", "special". */
  type: string;
  duration?: SpellDurationValue;
  concentration?: boolean;
  /** How a permanent effect ends: "dispel", "trigger". */
  ends?: string[];
}

export interface SpellComponents {
  v?: boolean;
  s?: boolean;
  /** A plain string, or an object once the material has a gp cost. */
  m?: string | { text?: string; cost?: number; consume?: boolean | string };
}

/* ------------------------------------------------------------------ *
 * School and level
 * ------------------------------------------------------------------ */

const SCHOOLS: Record<string, string> = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  V: "Evocation",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
};

export function schoolName(code: string | null | undefined): string {
  if (!code) return "—";
  return SCHOOLS[code] ?? code;
}

function ordinal(n: number): string {
  const suffix =
    n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

/** "Cantrip", "1st-level", "2nd-level"… */
export function levelLabel(level: number): string {
  return level === 0 ? "Cantrip" : `${ordinal(level)}-level`;
}

/** Compact form for a table cell, where "Cantrip" is too wide. */
export function levelShort(level: number): string {
  return level === 0 ? "—" : String(level);
}

/**
 * The line printed under a spell's name: "3rd-level evocation", or
 * "Evocation cantrip" — cantrips invert, which is why this is not a join.
 */
export function spellSubtitle(level: number, school: string | null): string {
  const name = schoolName(school);
  return level === 0
    ? `${name} cantrip`
    : `${levelLabel(level)} ${name.toLowerCase()}`;
}

/* ------------------------------------------------------------------ *
 * Casting time
 * ------------------------------------------------------------------ */

const TIME_UNITS: Record<string, string> = {
  action: "action",
  bonus: "bonus action",
  reaction: "reaction",
  round: "round",
  minute: "minute",
  hour: "hour",
};

const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);

/**
 * "1 action", "1 bonus action", "10 minutes".
 *
 * Only durations pluralise — "2 actions" never occurs as a casting time,
 * "10 minutes" does.
 */
function oneCastingTime(time: SpellTime): string {
  const base = TIME_UNITS[time.unit] ?? time.unit;
  const n = time.number ?? 1;
  const pluralises =
    time.unit === "minute" || time.unit === "hour" || time.unit === "round";

  return `${n} ${pluralises ? plural(n, base) : base}`;
}

/**
 * Casting time as printed.
 *
 * A reaction carries the trigger that provokes it, and dropping it makes the
 * spell unusable — "1 reaction" alone does not say when you may cast it. The
 * condition is returned separately so a table cell can show the short form
 * while a detail view shows the whole thing.
 */
export function formatCastingTime(
  times: SpellTime[] | undefined,
  options: { withCondition?: boolean } = {},
): string {
  if (!times?.length) return "—";

  const parts = times.map((time) => {
    const base = oneCastingTime(time);
    return options.withCondition && time.condition
      ? `${base}, ${time.condition}`
      : base;
  });

  return parts.join(" or ");
}

/* ------------------------------------------------------------------ *
 * Range
 * ------------------------------------------------------------------ */

/** Ranges that name a place rather than a measurement. */
const NAMED_DISTANCES: Record<string, string> = {
  self: "Self",
  touch: "Touch",
  sight: "Sight",
  unlimited: "Unlimited",
  special: "Special",
};

/** Area shapes are cast from the caster, so they print as "Self (…)". */
const AREA_SHAPES = new Set([
  "radius",
  "sphere",
  "cone",
  "line",
  "cube",
  "hemisphere",
  "cylinder",
]);

/**
 * Range as printed: "150 feet", "Touch", "Self (30-foot cone)".
 *
 * The area case is the one that cannot be reconstructed from the typed columns
 * at all — `range_feet` holds 30 for both "30 feet" and "Self (30-foot cone)",
 * which are different spells to be standing in front of.
 */
export function formatRange(range: SpellRange | null | undefined): string {
  if (!range) return "—";

  const distance = range.distance;
  const named = distance ? NAMED_DISTANCES[distance.type] : undefined;

  if (named) return named;
  if (!distance || distance.amount == null) return "—";

  const inMiles = distance.type === "miles";

  // Attributive, so it stays singular: "a 30-foot cone", never "30-feet".
  if (AREA_SHAPES.has(range.type)) {
    return `Self (${distance.amount}-${inMiles ? "mile" : "foot"} ${range.type})`;
  }

  const amount = groupDigits(distance.amount);

  if (inMiles) return `${amount} ${plural(distance.amount, "mile")}`;

  // "foot" is irregular, and a generic pluraliser silently yields "150 foots".
  return `${amount} ${distance.amount === 1 ? "foot" : "feet"}`;
}

/** "1,000" — as the books print it. Fixed locale so it never varies by reader. */
function groupDigits(value: number): string {
  return value.toLocaleString("en-US");
}

/* ------------------------------------------------------------------ *
 * Components
 * ------------------------------------------------------------------ */

/** "V, S, M" — letters only, for a table cell. */
export function componentLetters(
  components: SpellComponents | null | undefined,
): string {
  if (!components) return "—";

  const letters = [
    components.v ? "V" : null,
    components.s ? "S" : null,
    components.m ? "M" : null,
  ].filter(Boolean);

  return letters.length > 0 ? letters.join(", ") : "—";
}

/** The material component's text, if it has any. */
export function materialText(
  components: SpellComponents | null | undefined,
): string | null {
  const material = components?.m;
  if (!material) return null;
  if (typeof material === "string") return material;
  return material.text ?? null;
}

/** "V, S, M (a tiny ball of bat guano and sulfur)" — the full printed form. */
export function formatComponents(
  components: SpellComponents | null | undefined,
): string {
  const letters = componentLetters(components);
  const material = materialText(components);
  return material ? `${letters} (${material})` : letters;
}

/* ------------------------------------------------------------------ *
 * Duration
 * ------------------------------------------------------------------ */

const DURATION_UNITS: Record<string, string> = {
  round: "round",
  turn: "turn",
  minute: "minute",
  hour: "hour",
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

function oneDuration(duration: SpellDuration): string {
  switch (duration.type) {
    case "instant":
      return "Instantaneous";

    case "permanent":
      // "Until dispelled", or "Until dispelled or triggered" for glyphs.
      return duration.ends?.includes("trigger")
        ? "Until dispelled or triggered"
        : "Until dispelled";

    case "special":
      return "Special";

    case "timed": {
      const value = duration.duration;
      if (!value) return "—";

      const unit = DURATION_UNITS[value.type] ?? value.type;
      const text = `${value.amount} ${plural(value.amount, unit)}`;

      // Concentration subsumes "up to": the printed form is
      // "Concentration, up to 1 minute", never both prefixes at once.
      if (duration.concentration) return `Concentration, up to ${text}`;
      return value.upTo ? `Up to ${text}` : text;
    }

    default:
      return "—";
  }
}

/** Duration as printed. A handful of spells offer two, joined with "or". */
export function formatDuration(
  durations: SpellDuration[] | null | undefined,
): string {
  if (!durations?.length) return "—";
  return durations.map(oneDuration).join(" or ");
}

/* ------------------------------------------------------------------ *
 * Classes
 * ------------------------------------------------------------------ */

/** The corpus stores class names lowercased; they are proper nouns in print. */
export function formatClassList(classes: string[] | null | undefined): string {
  if (!classes?.length) return "—";
  return classes
    .map((name) => name.replace(/\b\w/g, (char) => char.toUpperCase()))
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
}
