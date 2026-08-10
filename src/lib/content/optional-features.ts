import { ordinal } from "./classes";

/**
 * Optional features: eldritch invocations, fighting styles, maneuvers,
 * metamagic, artificer infusions, arcane shots, runes, elemental disciplines
 * and pact boons. 151 entities in all, and every one of them is a choice some
 * class feature tells you to make.
 *
 * A class reaches them two ways, and both have to work or the feature that
 * points at them reads as an instruction with nothing to follow it:
 *
 *   - by name, as a `refOptionalfeature` entry inside a feature's text. This is
 *     how the Fighter's Fighting Style lists its six options.
 *   - by kind, through `optionalfeatureProgression` on the class or subclass.
 *     This is how a Warlock reaches 54 invocations that are named nowhere in
 *     its features — the text says only that a list exists elsewhere.
 */

/** A resolved option, ready to print under the feature that offers it. */
export interface OptionalFeatureBody {
  name: string;
  /** "Prerequisite: 5th level, Pact of the Blade", or null. */
  prerequisite: string | null;
  /** The option's own text, in renderer entry form. */
  entries?: unknown[];
  /** Named when the option comes from a different book than the class. */
  sourceId: string;
  sourceName: string;
}

/** Bodies by natural key. Absent keys render as a bare name. */
export type OptionalFeatureIndex = Record<string, OptionalFeatureBody>;

export const EMPTY_OPTIONAL_FEATURES: OptionalFeatureIndex = Object.freeze({});

/**
 * The natural key a `refOptionalfeature` addresses. The reference is
 * `Name` or `Name|SOURCE`, and PHB is assumed — the same rule `{@optfeature}`
 * follows, because they address the same entities.
 */
export function optionalFeatureKey(reference: string): string | null {
  const [name, source] = reference.split("|");
  const trimmed = name?.trim().toLowerCase();

  return trimmed
    ? `optionalfeature|${trimmed}|${(source?.trim() || "phb").toLowerCase()}`
    : null;
}

/**
 * Every optional feature referenced by name anywhere in a value, at any depth.
 * Collected up front so a page loads all of them in one query, the same way it
 * collects its cross-references.
 */
export function collectOptionalFeatures(value: unknown): Set<string> {
  const found = new Set<string>();

  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;

    const entry = node as { type?: unknown; optionalfeature?: unknown };
    if (
      entry.type === "refOptionalfeature" &&
      typeof entry.optionalfeature === "string"
    ) {
      const key = optionalFeatureKey(entry.optionalfeature);
      if (key) found.add(key);
    }

    Object.values(node).forEach(visit);
  };

  visit(value);
  return found;
}

/* ------------------------------------------------------------------ *
 * Kinds
 * ------------------------------------------------------------------ */

/**
 * What the codes on `optional_features.feature_types` mean.
 *
 * Ours, not the data's: nothing in `support_data` names these, and without the
 * names the list is 151 rows tagged `EI`, `MV:B` and `FS:F`. The order is the
 * one the rail shows them in — by how many options each kind has, which puts
 * the 54 invocations first and the 2 bardic fighting styles last.
 *
 * The three fighting-style codes stay separate rather than collapsing into one
 * "Fighting Style": which class a style belongs to is the only thing that
 * distinguishes two otherwise identical entries, and a warlock reading the list
 * cannot take the ranger's.
 */
const FEATURE_TYPE_LABELS: Record<string, string> = {
  EI: "Eldritch Invocation",
  "MV:B": "Battle Master Maneuver",
  ED: "Elemental Discipline",
  AI: "Artificer Infusion",
  "FS:F": "Fighting Style (Fighter)",
  MM: "Metamagic",
  AS: "Arcane Shot",
  "FS:R": "Fighting Style (Ranger)",
  "FS:P": "Fighting Style (Paladin)",
  RN: "Rune",
  PB: "Pact Boon",
  "FS:B": "Fighting Style (Bard)",
};

/** The codes in rail order. Anything unlisted sorts after, by its own name. */
export const FEATURE_TYPE_CODES = Object.keys(FEATURE_TYPE_LABELS);

export function featureTypeLabel(code: string): string {
  return FEATURE_TYPE_LABELS[code] ?? code;
}

/** Every kind an option belongs to, for its row. Several carry two. */
export function featureTypeSummary(codes: string[] | null): string {
  if (!codes || codes.length === 0) return "—";

  return codes.map(featureTypeLabel).join(", ");
}

/* ------------------------------------------------------------------ *
 * Prerequisites
 * ------------------------------------------------------------------ */

interface Prerequisite {
  level?: { level?: number };
  pact?: string;
  spell?: string[];
  item?: string[];
}

/**
 * "5th level, Pact of the Blade". 68 of the 151 options carry one, and it is
 * the difference between a list of choices and a list of choices you can make.
 *
 * The level is printed as a level alone, not "Warlock 5" — an option is only
 * ever listed under the class that grants it, so naming that class again is
 * noise. Where a spell prerequisite offers alternatives the corpus writes them
 * with slashes ("hex/curse"); they are joined with "or" rather than reproducing
 * upstream's hand-written phrasing for the two cases that exist.
 */
export function formatPrerequisites(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const clauses = value.flatMap((entry) => {
    const prerequisite = entry as Prerequisite;
    const parts: string[] = [];

    if (prerequisite.level?.level != null) {
      parts.push(`${ordinal(prerequisite.level.level)} level`);
    }

    if (prerequisite.pact) parts.push(`Pact of the ${prerequisite.pact}`);

    for (const spell of prerequisite.spell ?? []) {
      parts.push(spellRequirement(spell));
    }

    parts.push(...(prerequisite.item ?? []));

    return parts;
  });

  return clauses.length > 0 ? clauses.join(", ") : null;
}

/** "eldritch blast#c" is a cantrip; anything else is a spell. */
function spellRequirement(requirement: string): string {
  const [names, marker] = requirement.split("#");
  const kind = marker === "c" ? "cantrip" : "spell";

  return `${(names ?? "").split("/").join(" or ")} ${kind}`;
}

/* ------------------------------------------------------------------ *
 * Progressions
 * ------------------------------------------------------------------ */

export interface OptionalFeatureProgression {
  /** "Eldritch Invocations", "Fighting Style", "Maneuvers". */
  name: string;
  /** Codes into `optional_features.feature_types`: "EI", "FS:F", "MV:B". */
  featureTypes: string[];
  /** "Two at 3rd level, three at 10th, four at 17th." */
  known: string | null;
}

/**
 * What a class or subclass draws from, and how much of it.
 *
 * The count arrives either as a map of level to total ({"3": 2, "10": 3}) or as
 * a twenty-entry array of running totals. Both are read as the same thing: the
 * levels at which the number you know goes up, which is what the sentence under
 * the list has to say.
 */
export function optionalFeatureProgressions(
  data: unknown,
): OptionalFeatureProgression[] {
  const progressions = (
    data as {
      optionalfeatureProgression?: {
        name?: string;
        featureType?: string[];
        progression?: Record<string, number> | number[];
      }[];
    }
  )?.optionalfeatureProgression;

  if (!Array.isArray(progressions)) return [];

  return progressions.flatMap((progression) => {
    const featureTypes = progression.featureType?.filter(Boolean) ?? [];
    if (featureTypes.length === 0 || !progression.name) return [];

    return [
      {
        name: progression.name,
        featureTypes,
        known: formatKnown(progression.progression),
      },
    ];
  });
}

const COUNT_WORDS = [
  "none",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
];

const countWord = (value: number) => COUNT_WORDS[value] ?? String(value);

function formatKnown(
  progression: Record<string, number> | number[] | undefined,
): string | null {
  const steps = progressionSteps(progression);
  if (steps.length === 0) return null;

  const [first, ...rest] = steps;
  const sentence = [
    `${countWord(first!.count)} at ${ordinal(first!.level)} level`,
    ...rest.map((step) => `${countWord(step.count)} at ${ordinal(step.level)}`),
  ].join(", ");

  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** The levels at which the total goes up, in order. */
function progressionSteps(
  progression: Record<string, number> | number[] | undefined,
): { level: number; count: number }[] {
  if (!progression) return [];

  const totals = Array.isArray(progression)
    ? progression.map((count, index) => ({ level: index + 1, count }))
    : Object.entries(progression)
        .map(([level, count]) => ({ level: Number(level), count }))
        .sort((a, b) => a.level - b.level);

  const steps: { level: number; count: number }[] = [];
  let previous = 0;

  for (const total of totals) {
    if (!Number.isFinite(total.level) || total.count <= previous) continue;
    steps.push(total);
    previous = total.count;
  }

  return steps;
}
