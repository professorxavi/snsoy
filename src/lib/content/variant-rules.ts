/**
 * Variant rule display helpers.
 *
 * Like languages and unlike the other short rules types, a variant rule is not
 * summarised by hand: there are 115 of them across 13 books, and 5 share a slug
 * with a rule from another book. What the list carries instead is the one thing
 * the data types — whether a rule is offered as an alternative to the standard
 * one, as an addition to it, or both.
 */

/**
 * The `ruleType` code, spelled out.
 *
 * A **variant** replaces a rule the books already give; an **optional** rule
 * adds something that was not there. Fifteen are marked as both, which is the
 * books' own way of saying a rule can be taken either way. 40 carry no code at
 * all, and those get an em dash rather than a guess — being unmarked is not the
 * same as being standard.
 */
const RULE_TYPES: Record<string, string> = {
  V: "Variant",
  O: "Optional",
  VO: "Variant · Optional",
};

export function ruleTypeLabel(code: unknown): string | null {
  return typeof code === "string" ? RULE_TYPES[code] ?? code : null;
}

/** The same, for a table cell, where the column has to line up. */
export function ruleTypeCell(code: string | null | undefined): string {
  return ruleTypeLabel(code) ?? "—";
}
