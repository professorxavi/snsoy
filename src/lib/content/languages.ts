/**
 * Language display helpers.
 *
 * Unlike the other short rules types, a language is not summarised by hand. 135
 * of them come from 17 books and only 95 slugs are distinct — three books each
 * define a language called Common — so a slug-keyed map of the kind skills and
 * conditions use would answer for the wrong one. The list carries the fields
 * the data already holds instead: what kind of language it is, and what it is
 * written in.
 */

/** Capitalised for a table cell; the data stores these lowercase. */
const KINDS: Record<string, string> = {
  standard: "Standard",
  exotic: "Exotic",
  rare: "Rare",
  secret: "Secret",
};

/**
 * How common a language is. Em dash rather than an empty cell for the 66 that
 * do not say, so the column still lines up.
 */
export function languageKind(kind: string | null | undefined): string {
  if (!kind) return "—";

  return KINDS[kind] ?? kind;
}

/**
 * The script a language is written in, or a word saying it has none.
 *
 * Two books record `"none"` explicitly, which is a fact about the language
 * rather than a gap in the data — so it is spelled out rather than dashed like
 * the 38 that simply do not say.
 */
export function languageScript(script: string | null | undefined): string {
  if (!script) return "—";

  return script === "none" ? "None" : script;
}

/**
 * The line under the name in the aside: "Standard · Elvish script".
 *
 * Both facts or neither is worth a line — a panel that printed a lone em dash
 * would be saying there is something there.
 */
export function languageSubtitle(data: Record<string, unknown>): string | null {
  const kind = typeof data["type"] === "string" ? KINDS[data["type"]] : null;
  const script = typeof data["script"] === "string" ? data["script"] : null;

  const parts = [
    kind,
    script && script !== "none" ? `${script} script` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : null;
}
