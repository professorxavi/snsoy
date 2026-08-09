import { describe, expect, it } from "vitest";
import { abilityName, abilityPhrase } from "./dnd";

/**
 * Naming an ability in a sentence.
 *
 * The corpus stores abilities as three-letter codes, which is right for a stat
 * block and wrong everywhere a feature spells out a formula: "your cha
 * modifier" is not a sentence. Two cases beyond the plain one — a formula that
 * offers a choice, and one whose ability the class's own feature decides.
 */

describe("abilityName", () => {
  it("spells out an abbreviation", () => {
    expect(abilityName("cha")).toBe("Charisma");
    expect(abilityName("INT")).toBe("Intelligence");
  });

  /** Better a shouted code than a blank where an ability should be. */
  it("falls back to the code it was given", () => {
    expect(abilityName("xyz")).toBe("XYZ");
  });
});

describe("abilityPhrase", () => {
  it("names one ability", () => {
    expect(abilityPhrase(["cha"])).toBe("Charisma");
  });

  /** A Battle Master's maneuver DC keys off either. */
  it("offers a choice as a choice", () => {
    expect(abilityPhrase(["str", "dex"])).toBe("Strength or Dexterity");
    expect(abilityPhrase(["str", "dex", "con"])).toBe(
      "Strength, Dexterity or Constitution",
    );
  });

  /**
   * A Sidekick's casting ability is whatever its spellcasting feature granted,
   * so the corpus names no ability at all.
   */
  it("leaves an unfixed ability unnamed", () => {
    expect(abilityPhrase(["spellcasting"])).toBe("spellcasting ability");
  });

  it("has no phrase without an ability", () => {
    expect(abilityPhrase([])).toBeNull();
    expect(abilityPhrase(undefined)).toBeNull();
  });
});
