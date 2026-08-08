/**
 * Formats spell values for display. A school is stored as a single letter, a
 * range as a nested object, a duration as an array.
 *
 * These read the raw `data` object rather than the typed columns. The typed
 * columns are for filtering and sorting and are lossy: `range_feet` is null
 * whenever the range is not measured in feet (Touch, Self, Sight, Unlimited),
 * which covers 136 of the PHB's 361 spells.
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

/** Compact form for a table cell. Cantrips are "C", not a dash. */
export function levelShort(level: number): string {
  return level === 0 ? "C" : String(level);
}

/** "3rd-level evocation", or "Evocation cantrip". Cantrips invert the order. */
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

/** "1 action", "1 bonus action", "10 minutes". Only durations pluralise. */
function oneCastingTime(time: SpellTime): string {
  const base = TIME_UNITS[time.unit] ?? time.unit;
  const n = time.number ?? 1;
  const pluralises =
    time.unit === "minute" || time.unit === "hour" || time.unit === "round";

  return `${n} ${pluralises ? plural(n, base) : base}`;
}

/**
 * Casting time as printed. Reactions carry a trigger condition, which the
 * detail view includes and the table omits for width.
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
 * The area case cannot be rebuilt from the typed columns: `range_feet` holds 30
 * for both "30 feet" and "Self (30-foot cone)".
 */
export function formatRange(range: SpellRange | null | undefined): string {
  if (!range) return "—";

  const distance = range.distance;
  const named = distance ? NAMED_DISTANCES[distance.type] : undefined;

  if (named) return named;
  if (!distance || distance.amount == null) return "—";

  const inMiles = distance.type === "miles";

  // Attributive, so singular: "30-foot cone", not "30-feet".
  if (AREA_SHAPES.has(range.type)) {
    return `Self (${distance.amount}-${inMiles ? "mile" : "foot"} ${range.type})`;
  }

  const amount = groupDigits(distance.amount);

  if (inMiles) return `${amount} ${plural(distance.amount, "mile")}`;

  // "foot" is irregular; a generic pluraliser yields "150 foots".
  return `${amount} ${distance.amount === 1 ? "foot" : "feet"}`;
}

/** Fixed locale, so the separator does not vary by reader. */
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

      // Concentration subsumes "up to"; never both prefixes.
      if (duration.concentration) return `Concentration, up to ${text}`;
      return value.upTo ? `Up to ${text}` : text;
    }

    default:
      return "—";
  }
}

/** Duration as printed. A few spells offer two, joined with "or". */
export function formatDuration(
  durations: SpellDuration[] | null | undefined,
): string {
  if (!durations?.length) return "—";
  return durations.map(oneDuration).join(" or ");
}

/* ------------------------------------------------------------------ *
 * Classes
 * ------------------------------------------------------------------ */

/** Title-cases the stored class names. */
export function formatClassList(classes: string[] | null | undefined): string {
  if (!classes?.length) return "—";
  return classes
    .map((name) => name.replace(/\b\w/g, (char) => char.toUpperCase()))
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
}
