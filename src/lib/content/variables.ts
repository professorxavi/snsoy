import {
  abilityModifier,
  cleanMathExpression,
  crToProficiencyBonus,
  evaluateArithmetic,
  formatModifier,
  monsterShortName,
  sizeMultiplier,
} from "./dnd";
import { walkStrings } from "./walk";

/**
 * Resolves `<$variable$>` placeholders embedded in entry text.
 *
 * Base stat blocks are written generically so derived creatures inherit correct
 * prose: the archmage says `<$short_name$>`, and a copy renamed to "Animated
 * Statue" reads correctly without editing.
 *
 * Syntax is `<$mode$>` or `<$mode__detail$>`, e.g. `<$dc__con$>`,
 * `<$damage_avg__7+str$>`.
 */

/** The entity the variables are being resolved against. */
export type VariableContext = Record<string, unknown>;

const PATTERN = /<\$([^$]+)\$>/g;

type Resolver = (context: VariableContext, detail: string) => string | number;

const RESOLVERS: Record<string, Resolver> = {
  name: (ctx) => String(ctx.name ?? ""),

  short_name: (ctx) => monsterShortName(ctx),

  title_short_name: (ctx) => monsterShortName(ctx, { titleCase: true }),

  /** Save DC: 8 + ability modifier + proficiency bonus. */
  dc: (ctx, detail) =>
    8 + abilityModifier(ctx[detail]) + crToProficiencyBonus(ctx.cr),

  /** Same arithmetic as `dc`; the two exist only to read differently in prose. */
  spell_dc: (ctx, detail) =>
    8 + abilityModifier(ctx[detail]) + crToProficiencyBonus(ctx.cr),

  to_hit: (ctx, detail) =>
    formatModifier(crToProficiencyBonus(ctx.cr) + abilityModifier(ctx[detail])),

  /**
   * Rendered inline after damage dice, so it carries its own spacing and
   * collapses to nothing at +0: "1d8<$damage_mod__str$> slashing".
   */
  damage_mod: (ctx, detail) => {
    const modifier = abilityModifier(ctx[detail]);
    if (modifier === 0) return "";
    return modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
  },

  /**
   * Average damage from a formula that may reference ability scores and size,
   * e.g. `7+str` or `2.5*size_mult`.
   */
  damage_avg: (ctx, detail) => {
    const substituted = detail
      .replace(/\b(str|dex|con|int|wis|cha)\b/gi, (abbrev) =>
        String(abilityModifier(ctx[abbrev.toLowerCase()])),
      )
      .replace(/\bsize_mult\b/g, () => String(sizeMultiplier(ctx.size)));

    return Math.floor(evaluateArithmetic(cleanMathExpression(substituted)));
  },

  size_mult: (ctx, detail) => {
    const multiplier = sizeMultiplier(ctx.size);
    if (!detail) return multiplier;
    return Math.floor(multiplier * evaluateArithmetic(cleanMathExpression(detail)));
  },
};

/**
 * Substitute every `<$...$>` placeholder in a single string.
 *
 * Unknown modes are left verbatim rather than throwing, matching upstream. The
 * data contains at least one typo (`<$dc_wis$>`, single underscore) that
 * upstream renders unchanged.
 */
export function resolveVariablesInString(
  input: string,
  context: VariableContext,
): string {
  if (!input.includes("<$")) return input;

  return input.replace(PATTERN, (match, expression: string) => {
    const [mode, detail = ""] = expression.split("__");
    const resolver = RESOLVERS[mode];
    if (!resolver) return match;
    return String(resolver(context, detail));
  });
}

/** Recursively substitute placeholders through any JSON structure. */
export function resolveVariables<T>(value: T, context: VariableContext): T {
  return walkStrings(value, (str) => resolveVariablesInString(str, context));
}
