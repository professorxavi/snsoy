/**
 * Character creation options: the odds and ends a setting hands out at session
 * zero — a Theros supernatural gift, a Ravenloft dark gift, a Strixhaven
 * character secret, a giant rune.
 *
 * 44 entities in four kinds, and the kind is the only thing that separates
 * them. It arrives as a one-element JSON array on the blob (`["SG"]`) rather
 * than as a column, so a list row reads it as the text of that array and parses
 * it here.
 */

/**
 * Read off the entities themselves, not guessed from the codes. `RF:B` is the
 * one that would have been wrong: its nine rows are Cult of the Dragon
 * Infiltrator, Deep Delver, Mist Wanderer and the like — features that replace
 * the one a background came with, in Hoard of the Dragon Queen, Out of the
 * Abyss and Ravenloft.
 */
const KIND_LABELS: Record<string, string> = {
  CS: "Character Secret",
  SG: "Supernatural Gift",
  "RF:B": "Background Feature",
  DG: "Dark Gift",
};

/** The codes in rail order — by how many options each kind has. */
export const CHARACTER_OPTION_CODES = Object.keys(KIND_LABELS);

export function characterOptionLabel(code: string): string {
  return KIND_LABELS[code] ?? code;
}

/**
 * The kinds on one option, reached from either side.
 *
 * A list row gets `jsonb ->> 'optionType'`, which is the array's own JSON
 * (`'["SG"]'`) — that is what the shared generic field map produces, and the
 * whole reason it takes text at all. The aside has the parsed blob and so gets
 * the array itself. Anything else is no kinds rather than a thrown error: this
 * feeds one table cell and one subtitle, and a malformed row should cost that
 * cell, not the page.
 */
export function characterOptionKinds(value: unknown): string[] {
  const codes = typeof value === "string" ? parse(value) : value;

  return Array.isArray(codes)
    ? codes.filter((code): code is string => typeof code === "string")
    : [];
}

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The kind column: "Supernatural Gift", or an em dash where none is set. */
export function characterOptionSummary(value: unknown): string {
  const kinds = characterOptionKinds(value);
  if (kinds.length === 0) return "—";

  return kinds.map(characterOptionLabel).join(", ");
}
