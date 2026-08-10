import { ordinal, titleCase } from "./classes";
import { abilityName } from "./dnd";

/**
 * Feats, and the one thing a feat's own text never tells you.
 *
 * A feat's `entries` are the benefits alone — the prerequisite is structured
 * data beside them and is printed nowhere in the prose. 59 of the 105 feats
 * carry one, so without this formatter more than half the list reads as though
 * anyone could take anything.
 *
 * Every shape below was measured against the data rather than taken from a
 * schema. Alternatives within one clause are joined with "or" because that is
 * what the array means: `ability: [{int: 13}, {wis: 13}]` is Intelligence 13
 * *or* Wisdom 13, and rendering it as a list of requirements would state the
 * opposite.
 */

interface FeatPrerequisite {
  ability?: Record<string, number>[];
  race?: { name?: string; subrace?: string; displayEntry?: string }[];
  background?: { name?: string; displayEntry?: string }[];
  feat?: string[];
  level?: number | { level?: number; class?: { name?: string } };
  proficiency?: Record<string, string>[];
  campaign?: string[];
  spellcasting?: boolean;
  spellcasting2020?: boolean;
  spellcastingFeature?: boolean;
  other?: string;
}

/** "Strength 13" · "Elf or half-elf" · "4th level, Scion of the Outer Planes". */
export function featPrerequisite(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  /*
   * Each element of the outer array is an alternative way to qualify, and the
   * clauses inside one element all have to hold. Only 8 feats carry more than
   * one alternative, but reading those as a single conjunction would make
   * mutually exclusive requirements look like an impossible feat.
   */
  const alternatives = value
    .map((entry) => clauses(entry as FeatPrerequisite).join(", "))
    .filter(Boolean);

  return alternatives.length > 0 ? alternatives.join(" or ") : null;
}

function clauses(prerequisite: FeatPrerequisite): string[] {
  const parts: string[] = [];

  /*
   * Every ability entry is an alternative — Ritual Caster asks for
   * Intelligence 13 *or* Wisdom 13, and each element carries exactly one score
   * across all five feats that have this. Flattened rather than pushed one
   * clause at a time, which would have joined them with the comma that means
   * "and".
   */
  const abilities = (prerequisite.ability ?? []).flatMap((scores) =>
    Object.entries(scores).map(([code, score]) => `${abilityName(code)} ${score}`),
  );
  if (abilities.length > 0) parts.push(abilities.join(" or "));

  const races = (prerequisite.race ?? []).map(raceName).filter(Boolean);
  if (races.length > 0) parts.push(races.join(" or "));

  const backgrounds = (prerequisite.background ?? [])
    .map((background) => titleCase(background.name ?? ""))
    .filter(Boolean);
  if (backgrounds.length > 0) parts.push(`${backgrounds.join(" or ")} background`);

  const feats = (prerequisite.feat ?? []).map(featName).filter(Boolean);
  if (feats.length > 0) parts.push(`${feats.join(" or ")} feat`);

  const level = levelOf(prerequisite.level);
  if (level) parts.push(level);

  for (const proficiency of prerequisite.proficiency ?? []) {
    for (const [kind, value] of Object.entries(proficiency)) {
      parts.push(proficiencyPhrase(kind, value));
    }
  }

  // The three spellcasting flags differ upstream in *which* rules revision they
  // mean, and none of that distinction survives into anything a reader needs.
  if (
    prerequisite.spellcasting ||
    prerequisite.spellcasting2020 ||
    prerequisite.spellcastingFeature
  ) {
    parts.push("the ability to cast at least one spell");
  }

  if (prerequisite.campaign?.length) {
    parts.push(`${prerequisite.campaign.join(" or ")} campaign`);
  }

  if (prerequisite.other) parts.push(prerequisite.other);

  return parts;
}

/** "elf" → "Elf"; `{name: "elf", subrace: "drow"}` → "Elf (drow)". */
function raceName(race: { name?: string; subrace?: string }): string {
  if (!race.name) return "";

  return race.subrace
    ? `${titleCase(race.name)} (${race.subrace})`
    : titleCase(race.name);
}

/**
 * A feat prerequisite arrives as the reference to another feat —
 * `"scion of the outer planes|sato|scion of the outer planes (lawful outer
 * plane)"`. The display form after the second bar is the specific one where it
 * exists, since several of these point at a variant rather than at the feat.
 */
function featName(reference: string): string {
  const [name, , display] = reference.split("|");
  return titleCase((display || name || "").trim());
}

function levelOf(value: FeatPrerequisite["level"]): string | null {
  if (typeof value === "number") return `${ordinal(value)} level`;
  if (!value?.level) return null;

  const level = ordinal(value.level);
  return value.class?.name ? `${level}-level ${value.class.name}` : `${level} level`;
}

function proficiencyPhrase(kind: string, value: string): string {
  if (kind === "weaponGroup") return `${value} weapon proficiency`;
  return `${value} ${kind} proficiency`;
}
