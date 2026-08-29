import { describe, expect, it } from "vitest";
import {
  abilitySpreads,
  formatAbilityBonuses,
  formatSize,
  formatSpeed,
  raceTraits,
  walkingSpeed,
} from "./races";

/**
 * Shapes taken verbatim from the source data. The two easy to get wrong are
 * speed values of `true` and negative ability bonuses; both are real races.
 */

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

describe("formatSize", () => {
  it("expands the size code", () => {
    expect(formatSize(["M"])).toBe("Medium");
    expect(formatSize(["S"])).toBe("Small");
  });

  /** Some races let you choose, and the data stores both codes. */
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
        {
          choose: {
            from: ["str", "dex", "con", "int", "wis", "cha"],
            count: 2,
          },
        },
      ]),
    ).toBe("+1 to two of your choice");
  });

  it("joins alternative spreads with or", () => {
    expect(formatAbilityBonuses([{ str: 2 }, { dex: 2 }])).toBe(
      "+2 STR or +2 DEX",
    );
  });

  it("degrades on missing data", () => {
    expect(formatAbilityBonuses(null)).toBe("—");
    expect(formatAbilityBonuses([])).toBe("—");
  });
});

/**
 * From Van Richten's onwards a race stops dictating which abilities it raises.
 * The books print the rule once and mark the race with `lineage`, so 46 races
 * across seven books carry no `ability` at all and showed no ability line.
 */
describe("abilitySpreads", () => {
  it("gives a lineage race the rule it defers to", () => {
    const spreads = abilitySpreads({ ability: null, lineage: "VRGR" });

    expect(formatAbilityBonuses(spreads)).toBe(
      "+2 and +1 to two of your choice or +1 to three of your choice",
    );
  });

  it("leaves a race that states its own spread alone", () => {
    const spreads = abilitySpreads({
      ability: [{ con: 2 }],
      lineage: "VRGR",
    });

    expect(formatAbilityBonuses(spreads)).toBe("+2 CON");
  });

  /** `lineage: true` marks the one race that already states its own. */
  it("substitutes nothing for the filter marker", () => {
    expect(abilitySpreads({ ability: null, lineage: "true" })).toBeNull();
  });

  it("leaves an ordinary race with nothing to substitute", () => {
    expect(abilitySpreads({ ability: null })).toBeNull();
    expect(abilitySpreads({ ability: [] })).toBeNull();
  });
});

describe("weighted choices", () => {
  /** `count` and `amount` describe one amount repeated, which cannot say this. */
  it("names each amount when they differ", () => {
    expect(
      formatAbilityBonuses([
        { choose: { weighted: { from: ABILITIES, weights: [2, 1] } } },
      ]),
    ).toBe("+2 and +1 to two of your choice");
  });

  it("reads one amount repeated as an ordinary choice", () => {
    expect(
      formatAbilityBonuses([
        { choose: { weighted: { from: ABILITIES, weights: [1, 1, 1] } } },
      ]),
    ).toBe("+1 to three of your choice");
  });

  it("names the abilities when the choice is a narrow one", () => {
    expect(
      formatAbilityBonuses([
        { choose: { weighted: { from: ["str", "con"], weights: [1, 1] } } },
      ]),
    ).toBe("+1 to two of STR or CON");
  });

  it("says nothing for a weighting with no weights", () => {
    expect(
      formatAbilityBonuses([
        { choose: { weighted: { from: ABILITIES, weights: [] } } },
      ]),
    ).toBe("—");
  });
});

/**
 * The same rule that supplies the ability spread supplies the languages, and
 * the same 46 races were missing both.
 */
describe("raceTraits", () => {
  const flight = { type: "entries", name: "Flight", entries: ["You can fly."] };

  it("gives a lineage race the languages it is owed, after its own traits", () => {
    const traits = raceTraits([flight], "VRGR");

    expect(traits).toHaveLength(2);
    expect(traits[0]).toBe(flight);
    expect(JSON.stringify(traits[1])).toContain("one other language");
  });

  it("leaves an ordinary race exactly as the books wrote it", () => {
    const own = [flight];

    expect(raceTraits(own, null)).toBe(own);
    expect(raceTraits(own, "true")).toBe(own);
  });

  /** A book that starts printing one would otherwise get two. */
  it("adds nothing when the race states its own languages", () => {
    const own = [
      flight,
      { type: "entries", name: "Languages", entries: ["X."] },
    ];

    expect(raceTraits(own, "VRGR")).toHaveLength(2);
  });

  it("handles a race with no traits at all", () => {
    expect(raceTraits(undefined, "VRGR")).toHaveLength(1);
    expect(raceTraits(undefined, null)).toEqual([]);
  });
});
