import { describe, expect, it } from "vitest";
import { system } from "@/theme";

/**
 * WCAG contrast over the semantic colour tokens, measured in both modes.
 *
 * Light and dark are separate compositions, not inversions of each other —
 * several tokens carry a hand-picked value in one mode and a ramp reference in
 * the other — so a ratio that passes in one proves nothing about the other.
 * This asserts both independently.
 *
 * It reads the tokens rather than a transcribed table of hexes. A test holding
 * its own copy of the palette passes for ever while the theme drifts away
 * underneath it.
 */

/** Every ground a text role is actually painted on. */
const GROUNDS = ["bg", "bg.panel", "bg.muted", "bg.sunken"] as const;

/**
 * The text roles, and the grounds each is allowed to appear on.
 *
 * `fg`, `fg.muted` and `fg.subtle` go anywhere: they are the prose, the table
 * cells and the column headers. `brand` and `reference` as *text* are the
 * reading surfaces only — a purple control label or a cyan cross-reference sits
 * on the page or on a panel, never in an ability-score chip.
 */
const TEXT: Record<string, readonly string[]> = {
  fg: GROUNDS,
  "fg.muted": GROUNDS,
  "fg.subtle": GROUNDS,
  brand: ["bg", "bg.panel", "brand.subtle"],
  reference: ["bg", "bg.panel", "reference.subtle"],
  marque: ["bg", "bg.panel"],
  /** Text on a filled brand surface — the skip link and the primary control. */
  "brand.contrast": ["brand"],
};

const MODES = ["_light", "_dark"] as const;
type Mode = (typeof MODES)[number];

/**
 * A semantic token's hex in one mode.
 *
 * A condition's value is either a literal hex or a `{colors.x.y}` reference
 * into the raw ramps, so one hop of resolution covers every token here.
 */
function hex(name: string, mode: Mode): string {
  const token = system.tokens.getByName(`colors.${name}`);
  if (!token) throw new Error(`no such token: colors.${name}`);

  const raw = token.extensions.conditions?.[mode] ?? token.value;
  const reference = /^\{colors\.(.+)\}$/.exec(String(raw));
  if (!reference) return String(raw);

  const target = system.tokens.getByName(`colors.${reference[1]}`);
  if (!target) throw new Error(`colors.${name} points at a token that is not there`);
  return String(target.value);
}

/** Relative luminance, per WCAG 2.2 §Relative luminance. */
function luminance(value: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) throw new Error(`not a hex colour: ${value}`);

  const channels = [0, 2, 4].map((at) => {
    const c = parseInt(match[1].slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Two decimals, so a failure prints the number rather than a float smear. */
const round = (n: number) => Math.round(n * 100) / 100;

describe.each(MODES)("%s", (mode) => {
  describe("text clears WCAG AA on every ground it is used on", () => {
    for (const [role, grounds] of Object.entries(TEXT)) {
      for (const ground of grounds) {
        it(`${role} on ${ground}`, () => {
          expect(round(ratio(hex(role, mode), hex(ground, mode)))).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  });

  /**
   * Contrast alone would let the three text steps collapse into one another,
   * which passes AA and destroys the hierarchy the design depends on. Each step
   * must be quieter than the one above it against the same ground.
   */
  it("keeps the three text steps in order", () => {
    const against = (role: string) => ratio(hex(role, mode), hex("bg.panel", mode));

    expect(against("fg")).toBeGreaterThan(against("fg.muted"));
    expect(against("fg.muted")).toBeGreaterThan(against("fg.subtle"));
  });
});
