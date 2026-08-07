import { describe, expect, it } from "vitest";
import {
  formatAbilityBonuses,
  formatSize,
  formatSpeed,
  walkingSpeed,
} from "./races";

/**
 * Shapes taken verbatim from the loaded corpus. The two that bite are speed
 * values of `true` and negative ability bonuses — both look like edge cases and
 * both are real races.
 */

describe("formatSize", () => {
  it("expands the size code", () => {
    expect(formatSize(["M"])).toBe("Medium");
    expect(formatSize(["S"])).toBe("Small");
  });

  /** Some races let you choose, and the corpus stores both codes. */
  it("joins a choice of sizes", () => {
    expect(formatSize(["S", "M"])).toBe("Small or Medium");
  });

  it("passes through the varies marker", () => {
    expect(formatSize(["V"])).toBe("Varies");
  });

  it("degrades on missing data", () => {
    expect(formatSize(null)).toBe("—");
    expect(formatSize([])).toBe("—");
  });
});

describe("formatSpeed", () => {
  it("treats a bare number as walking speed", () => {
    expect(formatSpeed(25)).toBe("25 ft.");
  });

  it("labels every mode except walking", () => {
    expect(formatSpeed({ walk: 25, fly: 50 })).toBe("25 ft., fly 50 ft.");
    expect(formatSpeed({ walk: 20, swim: 40 })).toBe("20 ft., swim 40 ft.");
  });

  /**
   * The one that silently loses a race's flight: `true` means "equal to your
   * walking speed", and reading it as a boolean prints nothing.
   */
  it("resolves `true` to the walking speed", () => {
    expect(formatSpeed({ walk: 30, fly: true })).toBe("30 ft., fly 30 ft.");
    expect(formatSpeed({ walk: 35, climb: true })).toBe("35 ft., climb 35 ft.");
  });

  it("orders modes consistently rather than by key order", () => {
    expect(formatSpeed({ swim: 30, walk: 30, climb: 30 })).toBe(
      "30 ft., climb 30 ft., swim 30 ft.",
    );
  });

  it("extracts walking speed on its own", () => {
    expect(walkingSpeed(25)).toBe(25);
    expect(walkingSpeed({ walk: 30, fly: 60 })).toBe(30);
    expect(walkingSpeed(null)).toBeNull();
  });
});

describe("formatAbilityBonuses", () => {
  it("orders abilities as the sheet does, not alphabetically", () => {
    expect(formatAbilityBonuses([{ wis: 1, dex: 2 }])).toBe("+2 DEX, +1 WIS");
  });

  /** Several older races take a penalty; dropping the sign inverts the race. */
  it("keeps negative bonuses negative", () => {
    expect(formatAbilityBonuses([{ str: 2, int: -2 }])).toBe("+2 STR, −2 INT");
  });

  it("names a narrow choice", () => {
    expect(
      formatAbilityBonuses([
        { int: 1, choose: { from: ["dex", "cha"], count: 1, amount: 2 } },
      ]),
    ).toBe("+1 INT, +2 to DEX or CHA");
  });

  /** A choice from all six is "your choice" — listing them all reads as noise. */
  it("collapses an open choice", () => {
    expect(
      formatAbilityBonuses([
        { choose: { from: ["str", "dex", "con", "int", "wis", "cha"], count: 2 } },
      ]),
    ).toBe("+1 to two of your choice");
  });

  it("joins alternative spreads with or", () => {
    expect(formatAbilityBonuses([{ str: 2 }, { dex: 2 }])).toBe("+2 STR or +2 DEX");
  });

  it("degrades on missing data", () => {
    expect(formatAbilityBonuses(null)).toBe("—");
    expect(formatAbilityBonuses([])).toBe("—");
  });
});
