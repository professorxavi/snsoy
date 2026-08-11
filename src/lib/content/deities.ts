import { titleCase } from "./classes";
import { fieldValue } from "./field";
import { formatAlignment } from "./monsters";

/**
 * Deities — 494 of them across 23 pantheons, the largest type in the compendium
 * after the bestiary and the spell list.
 *
 * Almost everything about a god is a short field rather than prose: a title, a
 * pantheon, an alignment, domains, a symbol. 174 of the 494 carry any `entries`
 * at all, so the aside is mostly these lines, and the list is mostly these
 * columns.
 */

/** "Chaotic Good". Codes are the same `["C", "G"]` the bestiary uses. */
export function deityAlignment(value: unknown): string {
  const codes = fieldValue(value);
  if (!Array.isArray(codes)) return "—";

  const text = formatAlignment(codes as string[]);
  return text ? titleCase(text) : "—";
}

/** "Knowledge, War", the cleric domains a god's followers may choose. */
export function deityDomains(value: unknown): string {
  const domains = fieldValue(value);
  if (!Array.isArray(domains) || domains.length === 0) return "—";

  return domains.filter((name) => typeof name === "string").join(", ") || "—";
}

/**
 * The line under the name: what the god is god *of*, and whose god they are.
 *
 * The title is the books' own phrasing — "God of luck and music" — and 363 of
 * the 494 have one. The pantheon always does, and it is what tells a reader
 * whether this is the Faerûnian Bane or the Dragonlance one.
 */
export function deitySubtitle(data: Record<string, unknown>): string {
  const title = typeof data["title"] === "string" ? data["title"] : null;
  const pantheon =
    typeof data["pantheon"] === "string" ? `${data["pantheon"]} pantheon` : null;

  return [title, pantheon].filter(Boolean).join(" · ");
}

/**
 * The alignment as one facet value: `["C", "G"]` is `CG`.
 *
 * The codes stay in the URL and the words reach the rail, the same bargain the
 * item type facet makes — a filtered link keeps working if the wording changes.
 */
export function alignmentCode(codes: string[] | null | undefined): string {
  return (codes ?? []).join("");
}

/** "CG" back into "Chaotic Good", for the rail. */
export function alignmentLabel(code: string): string {
  return deityAlignment(code.split(""));
}
