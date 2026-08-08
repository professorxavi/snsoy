/**
 * Rules arithmetic shared by the copy resolver, the ingest pipeline, and the
 * renderer. Pure functions over raw data values — no I/O, no React.
 */

export const CR_UNKNOWN = Symbol("cr-unknown");

/**
 * Parse a challenge rating into a number.
 *
 * CR arrives as `"1/8"`, `"13"`, a bare number, or an object (`{cr: "5",
 * lair: "6"}`) for creatures whose rating changes in their lair. Returns
 * `CR_UNKNOWN` for the handful of stat blocks with no usable rating.
 */
export function crToNumber(cr: unknown): number | typeof CR_UNKNOWN {
  if (cr == null) return CR_UNKNOWN;
  if (typeof cr === "number") return cr;

  if (typeof cr === "object") {
    const inner = (cr as { cr?: unknown }).cr;
    return inner === undefined ? CR_UNKNOWN : crToNumber(inner);
  }

  const raw = String(cr).trim();
  if (!raw || /^(unknown|—|-)$/i.test(raw)) return CR_UNKNOWN;

  if (raw.includes("/")) {
    const [num, den] = raw.split("/").map(Number);
    return den ? num / den : CR_UNKNOWN;
  }

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? CR_UNKNOWN : parsed;
}

/** Proficiency bonus derived from CR. 0 when the CR is unusable. */
export function crToProficiencyBonus(cr: unknown): number {
  const num = crToNumber(cr);
  if (num === CR_UNKNOWN || num < 0) return 0;
  if (num < 5) return 2;
  return Math.ceil(num / 4) + 1;
}

/** Standard ability modifier: floor((score - 10) / 2). */
export function abilityModifier(score: unknown): number {
  const num = Number(score);
  if (Number.isNaN(num)) return 0;
  return Math.floor((num - 10) / 2);
}

/** Format a modifier for display: 3 -> "+3", -1 -> "-1". */
export function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

const SIZE_MULTIPLIER: Record<string, number> = { L: 2, H: 3, G: 4 };

/** Damage dice scale with size for some templates (e.g. giant variants). */
export function sizeMultiplier(size: unknown): number {
  const abbrev = Array.isArray(size) ? size[0] : size;
  return SIZE_MULTIPLIER[String(abbrev)] ?? 1;
}

/**
 * Strip everything that is not arithmetic, matching the reference
 * implementation's behaviour of sanitising a formula before evaluating it.
 */
export function cleanMathExpression(input: string): string {
  return input.replace(/[^-+/*0-9.,]+/g, "");
}

/**
 * Evaluate a simple arithmetic expression (`+ - * /`, decimals, parens-free).
 *
 * The reference implementation calls `eval()` here. We parse instead: these
 * strings originate in data files, and a data file should never be able to
 * execute code. Returns 0 for anything unparseable rather than throwing, since
 * the upstream behaviour on malformed input is a silent NaN.
 */
export function evaluateArithmetic(expression: string): number {
  const tokens = expression.replace(/,/g, "").match(/\d*\.?\d+|[-+*/]/g);
  if (!tokens?.length) return 0;

  // Pass 1: fold * and /, which bind tighter.
  const folded: (number | string)[] = [];
  let index = 0;

  const nextOperand = (): number => {
    let sign = 1;
    while (tokens[index] === "-" || tokens[index] === "+") {
      if (tokens[index] === "-") sign = -sign;
      index++;
    }
    const value = Number(tokens[index++]);
    return Number.isNaN(value) ? 0 : sign * value;
  };

  folded.push(nextOperand());

  while (index < tokens.length) {
    const operator = tokens[index++];
    if (operator === "*" || operator === "/") {
      const right = nextOperand();
      const left = folded.pop() as number;
      folded.push(operator === "*" ? left * right : right === 0 ? 0 : left / right);
    } else if (operator === "+" || operator === "-") {
      folded.push(operator, nextOperand());
    }
  }

  // Pass 2: fold the remaining + and - left to right.
  let total = folded[0] as number;
  for (let i = 1; i < folded.length; i += 2) {
    const operator = folded[i] as string;
    const operand = folded[i + 1] as number;
    total = operator === "+" ? total + operand : total - operand;
  }

  return total;
}

/**
 * The name used when a stat block refers to itself in its own prose —
 * "the goblin makes two attacks", "Al'chaia regains 10 hit points".
 *
 * Named creatures use their first name with no article; generic ones get a
 * lowercase "the". Dragon age categories are stripped so "Ancient Red Dragon"
 * refers to itself as "the dragon".
 */
export function monsterShortName(
  monster: {
    name?: string;
    shortName?: string | boolean;
    isNamedCreature?: boolean;
  },
  { titleCase = false }: { titleCase?: boolean } = {},
): string {
  const name = monster.name ?? "";
  const prefix = monster.isNamedCreature ? "" : titleCase ? "The " : "the ";

  if (monster.shortName === true) return `${prefix}${name}`;
  if (typeof monster.shortName === "string") {
    const short =
      !prefix && titleCase ? toTitleCase(monster.shortName) : monster.shortName.toLowerCase();
    return `${prefix}${short}`;
  }

  const base = name
    .split(",")[0]
    .replace(/(?:adult|ancient|young) \w+ (dragon|dracolich)/gi, "$1");

  return `${prefix}${monster.isNamedCreature ? base.split(" ")[0] : base.toLowerCase()}`;
}

function toTitleCase(input: string): string {
  return input.replace(/\b\w/g, (char) => char.toUpperCase());
}
