import { fieldValue } from "./field";

/**
 * Recipes — the Heroes' Feast cookbooks, and the one type in the compendium
 * whose text is not in `entries` at all.
 *
 * A recipe is `ingredients` and `instructions`, two entry arrays side by side,
 * and an ingredient line carries its quantities as placeholders rather than as
 * words: `"{=amount1/v} pound thick-cut bacon"` with `amount1: 0.5`. The books
 * set that as "½ pound", and the placeholder is what makes the same line
 * reusable at another scale.
 */

const DIET_LABELS: Record<string, string> = {
  V: "Vegan",
  C: "Vegetarian",
  X: "Meat",
};

/**
 * Read off the recipes rather than from a legend, as the other code maps in
 * this compendium were: `V` is the brandies and jams, `C` the puddings and
 * breads that use dairy or honey, `X` the bacon, chili and salmon.
 */
export function dietLabel(value: unknown): string {
  const code = fieldValue(value);
  if (typeof code !== "string") return "—";

  return DIET_LABELS[code] ?? code;
}

/** "Serves 4", "Serves 8–10", or "Serves 4 as a snack". */
export function servesSummary(value: unknown): string {
  const serves = fieldValue(value) as
    | { exact?: number; min?: number; max?: number; note?: string }
    | null;

  if (!serves) return "—";

  const count =
    serves.exact != null
      ? String(serves.exact)
      : serves.min != null && serves.max != null
        ? `${serves.min}–${serves.max}`
        : null;

  if (!count) return "—";

  return serves.note ? `${count} ${serves.note}` : count;
}

/**
 * "Uncommon Cuisine · Vegan · Serves 4 as a snack" — the line under the name.
 *
 * The cuisine is the book's own section heading, which is what tells a Dwarven
 * stew from a Yawning Portal one, and the diet is the thing anyone cooking from
 * this actually filters on.
 */
export function recipeSubtitle(data: Record<string, unknown>): string {
  const parts = [
    typeof data["type"] === "string" ? data["type"] : null,
    data["diet"] ? dietLabel(data["diet"]) : null,
    data["serves"] ? `Serves ${servesSummary(data["serves"])}` : null,
  ];

  return parts.filter((part) => part && part !== "—").join(" · ");
}

/* ------------------------------------------------------------------ *
 * Ingredient amounts
 * ------------------------------------------------------------------ */

const PLACEHOLDER = /\{=(amount\d+)(?:\/([a-z]+))?\}/g;

/** The fractions the cookbooks actually use, as the characters they set them in. */
const VULGAR: Record<string, string> = {
  "0.125": "⅛",
  "0.25": "¼",
  "0.33": "⅓",
  "0.5": "½",
  "0.67": "⅔",
  "0.75": "¾",
};

const SPELLED = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/**
 * One ingredient line with its quantities filled in.
 *
 * The modifiers are the cookbook's own, and all four occur: `v` sets a fraction
 * as a fraction (0.5 becomes ½, 1.5 becomes 1½), `x` spells a small number as a
 * word, `t` capitalises it because the placeholder opens the sentence, and `c`
 * is the plain count that a `{@unit}` tag reads to decide between "egg" and
 * "eggs". They combine, as in `{=amount1/cxt}`.
 *
 * An amount the line names but the data does not carry leaves the placeholder's
 * key rather than the raw brace text, which would otherwise render as an
 * unsupported tag in the middle of a sentence.
 */
export function ingredientText(ingredient: Record<string, unknown>): string {
  const entry = ingredient["entry"];
  if (typeof entry !== "string") return "";

  return entry.replace(PLACEHOLDER, (_match, key: string, modifiers = "") => {
    const amount = ingredient[key];
    if (typeof amount !== "number") return key;

    return formatAmount(amount, modifiers);
  });
}

function formatAmount(amount: number, modifiers: string): string {
  let text = String(amount);

  if (modifiers.includes("v")) text = vulgar(amount);
  else if (modifiers.includes("x")) text = SPELLED[amount] ?? text;

  if (modifiers.includes("t")) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text;
}

/** "1½", "½", or the number as written where no fraction fits. */
function vulgar(amount: number): string {
  const whole = Math.floor(amount);
  const fraction = VULGAR[(Math.round((amount - whole) * 1000) / 1000).toString()];

  if (!fraction) return String(amount);

  return whole > 0 ? `${whole}${fraction}` : fraction;
}
