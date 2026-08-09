/**
 * Formats the header of a monster's stat block — everything above the traits.
 *
 * These read the raw `data` object rather than the typed columns, for the same
 * reason the spell formatters do: the columns are for filtering and are lossy.
 * `armor_class` holds 13 for a creature printed as "13, 16 with mage armor",
 * `hit_points_average` is null for the 44 creatures whose hit points are a
 * sentence, and `alignment` is an array of one-letter codes.
 *
 * **The strings returned here may contain `{@tag}` markup and must be rendered
 * through `Inline`, not printed.** A creature's AC cites the spell that raises
 * it ("with {@spell mage armor}", 197 of them) and its armour cites the item it
 * wears. Escaping those to plain text would break links the book itself makes.
 *
 * Shapes were measured over all 3,628 creatures in the corpus; the counts in
 * the comments below say how many of them take each branch, so a branch with no
 * count is one the data does not currently exercise.
 */

import { abilityModifier, formatModifier, monsterShortName } from "./dnd";

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

/** A number that may carry a condition: `30 ft. (hover)`. */
export interface Qualified {
  number?: number;
  condition?: string;
}

export type AcEntry =
  | number
  | {
      ac?: number;
      /** What the AC comes from: armour worn, natural armor, a shield. */
      from?: string[];
      /** When this AC applies: "with {@spell mage armor}", "in wolf form". */
      condition?: string;
      /** Print the conditional AC in parentheses rather than after a comma. */
      braces?: boolean;
      /** An AC that is a formula, not a number: "13 + PB (natural armor)". */
      special?: string;
    };

export interface HitPoints {
  average?: number;
  formula?: string;
  /** 44 creatures state hit points in words — "40 + 10 for each spell level". */
  special?: string;
}

export type SpeedValue = number | Qualified;

export interface Speeds {
  walk?: SpeedValue;
  burrow?: SpeedValue;
  climb?: SpeedValue;
  fly?: SpeedValue;
  swim?: SpeedValue;
  /** Set alongside a fly speed whose condition already says "(hover)". */
  canHover?: boolean;
  /** A second full set of speeds, for a creature with two forms. */
  alternate?: unknown;
}

/** One entry in `immune`, `resist` or `vulnerable`. */
export type DefenceEntry =
  | string
  | {
      immune?: (string | DefenceEntry)[];
      resist?: (string | DefenceEntry)[];
      vulnerable?: (string | DefenceEntry)[];
      /** "nonmagical", set before the damage types. */
      preNote?: string;
      /** "from nonmagical attacks", set after them. */
      note?: string;
      cond?: boolean;
      /** A defence with no damage types at all: "damage from spells". */
      special?: string;
    };

export type AlignmentEntry =
  | string
  | {
      alignment?: string[];
      /** "50% neutral good, 50% neutral evil" — a creature rolled for. */
      chance?: number;
      note?: string;
      special?: string;
    };

export interface CreatureType {
  type?: string;
  /** "half-elf", "wizard", "shapechanger" — printed in parentheses. */
  tags?: (string | { tag?: string; prefix?: string })[];
  /** A swarm is described by the size of the things in it, not its own. */
  swarmSize?: string;
}

export type ChallengeRating =
  | string
  | {
      cr?: string;
      /** A higher rating while the creature is in its lair. */
      lair?: string;
      /** A higher rating while the hag is part of a coven. */
      coven?: string;
      /** An explicit award, overriding the table. Four creatures are worth 0. */
      xp?: number;
    };

const EM_DASH = "—";

/* ------------------------------------------------------------------ *
 * Size, type and alignment
 * ------------------------------------------------------------------ */

const SIZES: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan",
};

/** "Huge", or "Small or Medium" for the 56 creatures that span two sizes. */
export function formatSize(sizes: string[] | null | undefined): string {
  if (!sizes?.length) return "";
  const names = sizes.map((code) => SIZES[code] ?? code);
  return names.length === 1
    ? names[0]!
    : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

/**
 * "dragon", "humanoid (half-elf)", "swarm of Tiny beasts".
 *
 * A swarm names the size of its members rather than its own, which is why the
 * size and the type cannot be formatted independently of each other — see
 * `formatCreatureLine`.
 */
export function formatCreatureType(
  type: string | CreatureType | null | undefined,
): string {
  if (!type) return "";
  if (typeof type === "string") return type;

  const base = type.type ?? "";

  if (type.swarmSize) {
    const size = SIZES[type.swarmSize] ?? type.swarmSize;
    // "beast" pluralises to "beasts"; the corpus has no irregular creature type.
    return `swarm of ${size} ${base}s`;
  }

  const tags = (type.tags ?? [])
    .map((tag) =>
      typeof tag === "string"
        ? tag
        : [tag.prefix, tag.tag].filter(Boolean).join(" "),
    )
    .filter(Boolean);

  return tags.length ? `${base} (${tags.join(", ")})` : base;
}

/*
 * Alignment is stored as one-letter codes on two axes, and a range is written
 * as every code it covers rather than as a range. So "any evil alignment" is
 * `["L","NX","C","E"]` — the whole law axis, plus evil.
 *
 * `NX` is the neutral point of the law axis and `NY` the neutral point of the
 * morality axis; plain `N` is both at once. Deriving the phrasing from which
 * codes are present covers all 27 arrays the corpus uses without a table.
 */
const LAW_AXIS = ["L", "NX", "C"];
const MORAL_AXIS = ["G", "NY", "E"];

const ALIGNMENT_WORDS: Record<string, string> = {
  L: "lawful",
  C: "chaotic",
  N: "neutral",
  NX: "neutral",
  NY: "neutral",
  G: "good",
  E: "evil",
  U: "unaligned",
  A: "any alignment",
};

/**
 * "chaotic evil", "unaligned", "any non-good alignment".
 *
 * Lowercase, because it is printed mid-line after the creature's type. The
 * caller capitalises if it needs a sentence.
 */
export function formatAlignment(
  alignment: AlignmentEntry[] | null | undefined,
  prefix?: string | null,
): string {
  if (!alignment?.length) return "";

  const body = alignmentBody(alignment);
  if (!body) return "";

  // "typically chaotic evil" — 497 creatures whose alignment is a tendency.
  return prefix ? `${prefix.toLowerCase()} ${body}` : body;
}

function alignmentBody(alignment: AlignmentEntry[]): string {
  // Objects and codes never mix in one array, so the first element decides.
  if (typeof alignment[0] === "object") {
    return (alignment as Exclude<AlignmentEntry, string>[])
      .map(oneAlignmentOption)
      .filter(Boolean)
      .join(alignment.some((a) => typeof a === "object" && a?.chance) ? ", " : " or ");
  }

  return codesToAlignment(alignment as string[]);
}

function oneAlignmentOption(option: Exclude<AlignmentEntry, string>): string {
  if (option.special) return option.special;

  const body = codesToAlignment(option.alignment ?? []);
  if (!body) return "";

  const withChance = option.chance ? `${option.chance}% ${body}` : body;
  return option.note ? `${withChance} (${option.note})` : withChance;
}

function codesToAlignment(codes: string[]): string {
  if (codes.length === 0) return "";
  if (codes.length === 1) return ALIGNMENT_WORDS[codes[0]!] ?? codes[0]!;
  if (codes.length === 2) {
    return codes.map((code) => ALIGNMENT_WORDS[code] ?? code).join(" ");
  }

  const law = LAW_AXIS.filter((code) => codes.includes(code));
  const moral = MORAL_AXIS.filter((code) => codes.includes(code));

  // One axis wide open and the other pinned to a single value: "any evil".
  if (law.length === 3 && moral.length === 3) return "any alignment";
  if (law.length === 3 && moral.length === 1) {
    return `any ${ALIGNMENT_WORDS[moral[0]!]} alignment`;
  }
  if (moral.length === 3 && law.length === 1) {
    return `any ${ALIGNMENT_WORDS[law[0]!]} alignment`;
  }

  // Five of the six codes: everything except the one that is missing.
  if (law.length + moral.length === 5) {
    const missing = [...LAW_AXIS, ...MORAL_AXIS].find(
      (code) => !codes.includes(code),
    );
    if (missing) return `any non-${ALIGNMENT_WORDS[missing]} alignment`;
  }

  return codes.map((code) => ALIGNMENT_WORDS[code] ?? code).join(" ");
}

/**
 * The line under the creature's name: "Huge dragon, chaotic evil".
 *
 * A swarm reads "Medium swarm of Tiny beasts", where the first size is the
 * swarm's and the second its members' — which is why this composes the three
 * parts rather than leaving the caller to join them.
 */
export function formatCreatureLine(data: {
  size?: string[];
  type?: string | CreatureType;
  alignment?: AlignmentEntry[];
  alignmentPrefix?: string;
}): string {
  const parts = [formatSize(data.size), formatCreatureType(data.type)].filter(
    Boolean,
  );
  const head = parts.join(" ");
  const alignment = formatAlignment(data.alignment, data.alignmentPrefix);

  if (!head) return alignment;
  return alignment ? `${head}, ${alignment}` : head;
}

/* ------------------------------------------------------------------ *
 * Defences
 * ------------------------------------------------------------------ */

/**
 * "19 (natural armor)", "13, 16 with mage armor", "12 (natural armor) in wolf
 * or hybrid form".
 *
 * The first entry is the creature's base AC and the rest are alternatives.
 * `braces` decides how an alternative is joined: with it the alternative goes
 * in parentheses, without it after a comma.
 */
export function formatArmorClass(ac: AcEntry[] | null | undefined): string {
  if (!ac?.length) return EM_DASH;

  const parts: string[] = [];

  for (const entry of ac) {
    if (typeof entry === "number") {
      parts.push(String(entry));
      continue;
    }
    if (entry.special) {
      parts.push(entry.special);
      continue;
    }
    if (entry.ac == null) continue;

    const from = entry.from?.length ? ` (${entry.from.join(", ")})` : "";
    const condition = entry.condition ? ` ${entry.condition}` : "";
    const text = `${entry.ac}${from}${condition}`;

    parts.push(entry.braces ? `(${text})` : text);
  }

  if (parts.length === 0) return EM_DASH;

  // A braced alternative reads as an aside on the AC before it, so it follows a
  // space; anything else is a separate value and follows a comma.
  return parts.reduce((line, part) =>
    part.startsWith("(") ? `${line} ${part}` : `${line}, ${part}`,
  );
}

/** "256 (19d12 + 133)", or the sentence the 44 special cases state instead. */
export function formatHitPoints(hp: HitPoints | null | undefined): string {
  if (!hp) return EM_DASH;
  if (hp.special) return hp.special;
  if (hp.average == null) return EM_DASH;
  return hp.formula ? `${hp.average} (${hp.formula})` : String(hp.average);
}

/** Walk first and unlabelled, as in print; the rest in a fixed order after it. */
const SPEED_ORDER = ["walk", "burrow", "climb", "fly", "swim"] as const;

/** "40 ft., climb 40 ft., fly 80 ft. (hover)". */
export function formatSpeed(speed: Speeds | null | undefined): string {
  if (!speed) return EM_DASH;

  const parts: string[] = [];

  for (const kind of SPEED_ORDER) {
    const value = speed[kind];
    if (value == null) continue;

    const amount = typeof value === "number" ? value : value.number;
    if (amount == null) continue;

    const condition = typeof value === "number" ? "" : value.condition;
    // Walk is the default mode and goes unnamed, exactly as the book prints it.
    const label = kind === "walk" ? "" : `${kind} `;

    parts.push(`${label}${amount} ft.${condition ? ` ${condition}` : ""}`);
  }

  /*
   * `canHover` and `alternate` are deliberately not printed. The first is
   * already said by the fly speed's own condition — every creature carrying it
   * has `fly: {condition: "(hover)"}` — and printing it again gives "fly 30 ft.
   * (hover) (hover)". The second is a second full set of speeds for a
   * creature's other form, which three creatures have and which belongs with
   * that form's other statistics rather than crammed into this line.
   */

  return parts.length ? parts.join(", ") : EM_DASH;
}

/**
 * "bludgeoning, piercing, slashing from nonmagical attacks".
 *
 * `key` says which field holds the nested types, because the wrapper object
 * names it after the defence it belongs to — `{cond, note, immune: [...]}` in
 * `immune`, `{cond, note, resist: [...]}` in `resist`.
 */
export function formatDefences(
  entries: DefenceEntry[] | null | undefined,
  key: "immune" | "resist" | "vulnerable",
): string {
  if (!entries?.length) return "";

  /*
   * Two separators, as in print. Plain damage types are one list and take
   * commas; a group with a note of its own is a separate clause and takes a
   * semicolon, so "fire, poison; bludgeoning, piercing, slashing from
   * nonmagical attacks" reads as two statements rather than five items.
   */
  const clauses: string[] = [];
  let plain: string[] = [];

  const flushPlain = () => {
    if (plain.length) clauses.push(plain.join(", "));
    plain = [];
  };

  for (const entry of entries) {
    if (typeof entry === "string") {
      plain.push(entry);
      continue;
    }

    if (entry.special) {
      flushPlain();
      clauses.push(entry.special);
      continue;
    }

    const nested = entry[key];
    if (!nested?.length) continue;

    // Nested groups do not nest further in the corpus, but the type allows it.
    const types = nested
      .map((inner) => (typeof inner === "string" ? inner : formatDefences([inner], key)))
      .filter(Boolean)
      .join(", ");
    if (!types) continue;

    const qualified = [entry.preNote, types, entry.note].filter(Boolean).join(" ");

    // An unqualified group is just more damage types, so it joins the run.
    if (!entry.preNote && !entry.note) {
      plain.push(types);
      continue;
    }

    flushPlain();
    clauses.push(qualified);
  }

  flushPlain();
  return clauses.join("; ");
}

/** "charmed, exhaustion, frightened" — plain strings, unlike damage defences. */
export function formatConditionImmunities(
  entries: string[] | null | undefined,
): string {
  return entries?.length ? entries.join(", ") : "";
}

/**
 * "blindsight 60 ft., darkvision 120 ft., passive Perception 23".
 *
 * Passive Perception is stored apart from the senses but printed inside them,
 * and every stat block ends its senses line with it.
 */
export function formatSenses(
  senses: string[] | null | undefined,
  passive: number | null | undefined,
): string {
  const parts = [...(senses ?? [])];
  if (passive != null) parts.push(`passive Perception ${passive}`);
  return parts.length ? parts.join(", ") : EM_DASH;
}

export function formatLanguages(
  languages: string[] | null | undefined,
): string {
  return languages?.length ? languages.join(", ") : EM_DASH;
}

/* ------------------------------------------------------------------ *
 * Abilities, saves and skills
 * ------------------------------------------------------------------ */

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

export type Ability = (typeof ABILITIES)[number];

export interface AbilityScore {
  ability: Ability;
  score: number | null;
  /** "+8", or null where the creature has no score for that ability. */
  modifier: string | null;
}

/** The six scores in their printed order, each with its derived modifier. */
export function abilityScores(
  data: Partial<Record<Ability, number>>,
): AbilityScore[] {
  return ABILITIES.map((ability) => {
    const score = data[ability];
    return {
      ability,
      score: score ?? null,
      modifier: score == null ? null : formatModifier(abilityModifier(score)),
    };
  });
}

/** "Con +13, Wis +7" — in ability order, not the order the data stores them. */
export function formatSaves(
  save: Partial<Record<string, string>> | null | undefined,
): string {
  if (!save) return "";

  return ABILITIES.filter((ability) => save[ability])
    .map(
      (ability) =>
        `${ability[0]!.toUpperCase()}${ability.slice(1)} ${save[ability]}`,
    )
    .join(", ");
}

/** "Perception +13, Stealth +6" — alphabetical, as the books print them. */
export function formatSkills(
  skills: Partial<Record<string, string>> | null | undefined,
): string {
  if (!skills) return "";

  return Object.entries(skills)
    .filter(([name, bonus]) => name !== "other" && bonus)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bonus]) => `${titleCase(name)} ${bonus}`)
    .join(", ");
}

function titleCase(input: string): string {
  return input.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/* ------------------------------------------------------------------ *
 * Challenge rating
 * ------------------------------------------------------------------ */

/** Experience awarded per challenge rating, from the rules' own table. */
const XP_BY_CR: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000,
};

/** "17 (18,000 XP)", with the lair or coven rating after it where there is one. */
export function formatChallenge(cr: ChallengeRating | null | undefined): string {
  if (cr == null) return EM_DASH;

  if (typeof cr === "string") return withXp(cr);

  const base = cr.cr;
  if (!base) return EM_DASH;

  // An explicit award beats the table: four creatures are rated 0 and worth 0.
  const head = cr.xp != null ? `${base} (${groupDigits(cr.xp)} XP)` : withXp(base);

  if (cr.lair) return `${head} or ${withXp(cr.lair)} while in its lair`;
  if (cr.coven) return `${head} or ${withXp(cr.coven)} while in a coven`;
  return head;
}

function withXp(cr: string): string {
  const xp = XP_BY_CR[cr.trim()];
  return xp == null ? cr : `${cr} (${groupDigits(xp)} XP)`;
}

/** Fixed locale, so the separator does not vary by reader. */
function groupDigits(value: number): string {
  return value.toLocaleString("en-US");
}

/* ------------------------------------------------------------------ *
 * Legendary actions
 * ------------------------------------------------------------------ */

/**
 * The paragraph above a creature's legendary actions, explaining how many it
 * gets and when.
 *
 * Synthesised, because the corpus does not store it: 351 creatures have
 * legendary actions and only ten carry a `legendaryHeader` of their own. The
 * sentence is fixed apart from the creature's name and the number it may take,
 * so the ten that differ override it and the rest get this.
 *
 * The name is the one the creature calls itself in its own prose — "the dragon"
 * for an Ancient Red Dragon, "Strahd" for Strahd — which is the same rule its
 * actions already follow, so the intro reads continuously with them.
 */
export function legendaryIntro(data: {
  name?: string;
  shortName?: string | boolean;
  isNamedCreature?: boolean;
  legendaryActions?: number;
}): string {
  const count = data.legendaryActions ?? 3;
  const subject = monsterShortName(data, { titleCase: true });

  /*
   * "its turn" for a creature, "their turn" for a named one. The corpus records
   * no gender, and a named creature referred to as "it" reads as a mistake —
   * so the one that is right either way is used where the answer is unknown.
   */
  const possessive = data.isNamedCreature ? "their" : "its";

  return (
    `${subject} can take ${count} legendary action${count === 1 ? "" : "s"}, ` +
    "choosing from the options below. Only one legendary action option can be " +
    "used at a time and only at the end of another creature's turn. " +
    `${subject} regains spent legendary actions at the start of ${possessive} turn.`
  );
}

/* ------------------------------------------------------------------ *
 * Spellcasting
 * ------------------------------------------------------------------ */

/**
 * The heading above one group of innate spells.
 *
 * The corpus keys these groups by a count with an optional `e` suffix: `"1e"`
 * is one casting of each spell in the group, `"2"` two castings shared between
 * them. `period` is the recovery it counts against.
 */
export function spellFrequencyLabel(key: string, period: string): string {
  const each = key.endsWith("e");
  const count = each ? key.slice(0, -1) : key;
  return `${count}/${period}${each ? " each" : ""}`;
}

/** "Cantrips (at will)", "1st level (4 slots)", "3rd level (3 slots)". */
export function spellLevelLabel(level: string, slots?: number): string {
  if (level === "0") return "Cantrips (at will)";

  const n = Number(level);
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  const slotText =
    slots == null
      ? ""
      : slots === 0
        ? " (0 slots)"
        : ` (${slots} slot${slots === 1 ? "" : "s"})`;

  return `${n}${suffix} level${slotText}`;
}
