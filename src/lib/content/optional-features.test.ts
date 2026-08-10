import { describe, expect, it } from "vitest";
import {
  collectOptionalFeatures,
  featureTypeSummary,
  formatPrerequisites,
  optionalFeatureKey,
  optionalFeatureProgressions,
} from "./optional-features";

/**
 * Reaching the options a class chooses between.
 *
 * Two routes, and the failure is the same either way: a feature that says
 * "choose one of the following" above nothing at all. Addressing an option by
 * name has to produce the key the entity is actually stored under, and a class
 * that names none of its options has to be found by kind instead — a Warlock's
 * 54 invocations exist nowhere in its feature text.
 */

describe("optionalFeatureKey", () => {
  it("assumes the PHB, the way the tag that addresses the same entity does", () => {
    expect(optionalFeatureKey("Archery")).toBe("optionalfeature|archery|phb");
  });

  it("takes the source when the reference carries one", () => {
    expect(optionalFeatureKey("Blind Fighting|TCE")).toBe(
      "optionalfeature|blind fighting|tce",
    );
  });

  it("has no key for a reference with no name", () => {
    expect(optionalFeatureKey("")).toBeNull();
    expect(optionalFeatureKey("  |TCE")).toBeNull();
  });
});

describe("collectOptionalFeatures", () => {
  /** They sit several levels down inside a feature's entries, never at the top. */
  it("finds every option named at any depth", () => {
    const feature = {
      entries: [
        "Choose one of the following options.",
        {
          type: "options",
          count: 1,
          entries: [
            { type: "refOptionalfeature", optionalfeature: "Archery" },
            { type: "refOptionalfeature", optionalfeature: "Blind Fighting|TCE" },
          ],
        },
      ],
    };

    expect([...collectOptionalFeatures([feature])]).toEqual([
      "optionalfeature|archery|phb",
      "optionalfeature|blind fighting|tce",
    ]);
  });

  it("finds nothing in a feature that names no options", () => {
    expect(collectOptionalFeatures({ entries: ["Plain text."] }).size).toBe(0);
  });
});

describe("formatPrerequisites", () => {
  it("reads a level, a pact and a spell into one clause", () => {
    expect(
      formatPrerequisites([
        { level: { level: 9 }, pact: "Tome", spell: ["eldritch blast#c"] },
      ]),
    ).toBe("9th level, Pact of the Tome, eldritch blast cantrip");
  });

  /** A `#c` marker is a cantrip; anything else is a spell. */
  it("names alternatives as alternatives", () => {
    expect(formatPrerequisites([{ spell: ["hex/curse#x"] }])).toBe(
      "hex or curse spell",
    );
  });

  it("takes an item requirement as written", () => {
    expect(
      formatPrerequisites([{ item: ["A suit of armor (requires attunement)"] }]),
    ).toBe("A suit of armor (requires attunement)");
  });

  it("has nothing to say for an option with no prerequisites", () => {
    expect(formatPrerequisites(null)).toBeNull();
    expect(formatPrerequisites([])).toBeNull();
  });
});

describe("optionalFeatureProgressions", () => {
  /** A map of level to running total — how most classes store it. */
  it("reads the levels at which the number known goes up", () => {
    const [metamagic] = optionalFeatureProgressions({
      optionalfeatureProgression: [
        {
          name: "Metamagic",
          featureType: ["MM"],
          progression: { "3": 2, "10": 3, "17": 4 },
        },
      ],
    });

    expect(metamagic).toEqual({
      name: "Metamagic",
      featureTypes: ["MM"],
      known: "Two at 3rd level, three at 10th, four at 17th",
    });
  });

  /**
   * The Warlock and the Artificer store the same thing as a twenty-entry array
   * of running totals, most of them repeats of the level before.
   */
  it("reads an array of totals as the same set of steps", () => {
    const [invocations] = optionalFeatureProgressions({
      optionalfeatureProgression: [
        {
          name: "Eldritch Invocations",
          featureType: ["EI"],
          progression: [0, 2, 2, 2, 3, 3, 4],
        },
      ],
    });

    expect(invocations!.known).toBe(
      "Two at 2nd level, three at 5th, four at 7th",
    );
  });

  it("has no progression for a class that offers no options", () => {
    expect(optionalFeatureProgressions({ name: "Wizard" })).toEqual([]);
    expect(optionalFeatureProgressions(null)).toEqual([]);
  });

  /** A progression with no feature type cannot be looked up, so it is dropped. */
  it("drops a progression it could not query for", () => {
    expect(
      optionalFeatureProgressions({
        optionalfeatureProgression: [{ name: "Mystery", progression: { "1": 1 } }],
      }),
    ).toEqual([]);
  });
});

/**
 * The codes are ours, not the data's — nothing in `support_data` names them, so
 * without this map the browse list is 151 rows tagged `EI` and `MV:B`.
 */
describe("featureTypeSummary", () => {
  it("names a kind", () => {
    expect(featureTypeSummary(["EI"])).toBe("Eldritch Invocation");
    expect(featureTypeSummary(["MV:B"])).toBe("Battle Master Maneuver");
  });

  /** 25 options carry two: a fighting style shared between two classes. */
  it("names both kinds where an option belongs to two", () => {
    expect(featureTypeSummary(["FS:F", "FS:R"])).toBe(
      "Fighting Style (Fighter), Fighting Style (Ranger)",
    );
  });

  it("passes an unknown code through rather than blanking the cell", () => {
    expect(featureTypeSummary(["ZZ"])).toBe("ZZ");
  });

  it("prints an em dash for nothing", () => {
    expect(featureTypeSummary([])).toBe("—");
    expect(featureTypeSummary(null)).toBe("—");
  });
});
