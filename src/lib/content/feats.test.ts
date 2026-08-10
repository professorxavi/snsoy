import { describe, expect, it } from "vitest";
import { featPrerequisite } from "./feats";

/**
 * A feat's prerequisite is the one fact its own text never states, so this
 * formatter is the whole of what a reader sees before deciding whether the feat
 * is available to them. Every shape below is one the data actually contains —
 * they were read off the 59 feats that carry a prerequisite, not off a schema.
 */

describe("featPrerequisite", () => {
  it("is absent where a feat has none", () => {
    expect(featPrerequisite(null)).toBeNull();
    expect(featPrerequisite([])).toBeNull();
  });

  it("names an ability score", () => {
    expect(featPrerequisite([{ ability: [{ str: 13 }] }])).toBe("Strength 13");
  });

  /**
   * The alternatives inside one clause are a choice, not a list of demands —
   * the Ritual Caster feat wants Intelligence 13 *or* Wisdom 13, and joining
   * them with a comma would state the opposite.
   */
  it("reads a choice of abilities as a choice", () => {
    expect(featPrerequisite([{ ability: [{ int: 13 }, { wis: 13 }] }])).toBe(
      "Intelligence 13 or Wisdom 13",
    );
  });

  it("capitalises races and keeps a subrace beside its parent", () => {
    expect(featPrerequisite([{ race: [{ name: "elf", subrace: "drow" }] }])).toBe(
      "Elf (drow)",
    );
    expect(
      featPrerequisite([{ race: [{ name: "half-elf" }, { name: "half-orc" }] }]),
    ).toBe("Half-Elf or Half-Orc");
  });

  it("names the class where a level requirement has one", () => {
    expect(
      featPrerequisite([{ level: { level: 1, class: { name: "Sorcerer" } } }]),
    ).toBe("1st-level Sorcerer");
    expect(featPrerequisite([{ level: 4 }])).toBe("4th level");
  });

  /** The reference carries the feat three times over; only the last is prose. */
  it("takes a feat prerequisite's display form, not its key", () => {
    expect(
      featPrerequisite([
        {
          feat: ["scion of the outer planes|sato|scion of the outer planes (evil outer plane)"],
          level: 4,
        },
      ]),
    ).toBe("Scion of the Outer Planes (Evil Outer Plane) feat, 4th level");
  });

  it("says what a spellcasting requirement means, whichever flag carries it", () => {
    expect(featPrerequisite([{ spellcasting: true }])).toBe(
      "the ability to cast at least one spell",
    );
    expect(featPrerequisite([{ spellcasting2020: true }])).toBe(
      "the ability to cast at least one spell",
    );
  });

  it("reads proficiencies", () => {
    expect(featPrerequisite([{ proficiency: [{ armor: "heavy" }] }])).toBe(
      "heavy armor proficiency",
    );
    expect(featPrerequisite([{ proficiency: [{ weaponGroup: "martial" }] }])).toBe(
      "martial weapon proficiency",
    );
  });

  /**
   * Two elements of the outer array are two separate ways to qualify. Eight
   * feats are written this way, and reading them as one conjunction would make
   * a takeable feat look impossible.
   */
  it("joins alternative routes with or, and clauses within one with commas", () => {
    expect(
      featPrerequisite([
        { race: [{ name: "dwarf" }] },
        { ability: [{ con: 13 }], level: 4 },
      ]),
    ).toBe("Dwarf or Constitution 13, 4th level");
  });

  it("passes prose requirements through as written", () => {
    expect(featPrerequisite([{ other: "No other dragonmark" }])).toBe(
      "No other dragonmark",
    );
  });
});
