import { describe, expect, it } from "vitest";
import {
  byPrintedOrder,
  collectFeatureReferences,
  descriptionEntries,
  featureOrder,
  featureReferenceKey,
  indexFeatures,
  formatAbilities,
  ordinal,
  proficiencyBonus,
  proficiencyLines,
  progressionColumns,
  startingEquipment,
} from "./classes";

/**
 * Reading a class out of the books.
 *
 * Nothing about a class is stored the way it is printed. The progression table
 * is a set of grids under two different keys with five cell shapes between
 * them; the proficiencies are four lines built from four unrelated structures;
 * the order features are printed in exists only as an array of reference
 * strings. Every one of those is a chance to render a plausible-looking table
 * that is quietly wrong, which is what these cover.
 */

describe("proficiencyBonus", () => {
  it("starts at +2 and rises every fourth level", () => {
    expect([1, 4, 5, 9, 13, 17, 20].map(proficiencyBonus)).toEqual([
      2, 2, 3, 4, 5, 6, 6,
    ]);
  });
});

describe("ordinal", () => {
  it("suffixes a level the way the books set it", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 20].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "20th",
    ]);
  });
});

describe("formatAbilities", () => {
  it("names abilities in full, in the order given", () => {
    expect(formatAbilities(["str", "con"])).toBe("Strength & Constitution");
    expect(formatAbilities([])).toBeNull();
    expect(formatAbilities(null)).toBeNull();
  });
});

describe("progressionColumns", () => {
  /** The Barbarian's Rages and Rage Damage: a group with no heading. */
  it("reads a plain grid into one column per label", () => {
    const columns = progressionColumns({
      classTableGroups: [
        {
          colLabels: ["Rages", "Rage Damage"],
          rows: [
            ["2", { type: "bonus", value: 2 }],
            ["Unlimited", { type: "bonus", value: 4 }],
          ],
        },
      ],
    });

    expect(columns).toHaveLength(2);
    expect(columns[0]!.label).toBe("Rages");
    expect(columns[0]!.values.slice(0, 2)).toEqual(["2", "Unlimited"]);
    expect(columns[1]!.values.slice(0, 2)).toEqual(["+2", "+4"]);
  });

  /** Spell slots arrive under their own key, and carry the group's heading. */
  it("reads a spell progression, and keeps its heading with it", () => {
    const columns = progressionColumns({
      classTableGroups: [
        {
          title: "Spell Slots per Spell Level",
          colLabels: ["1st", "2nd"],
          rowsSpellProgression: [
            [2, 0],
            [3, 0],
            [4, 2],
          ],
        },
      ],
    });

    expect(columns.map((column) => column.group)).toEqual([
      "Spell Slots per Spell Level",
      "Spell Slots per Spell Level",
    ]);
    // A slot level not yet reached is nothing, and prints as a dash.
    expect(columns[1]!.values.slice(0, 3)).toEqual(["—", "—", "2"]);
  });

  it("gives every column a value for all twenty levels", () => {
    const [column] = progressionColumns({
      classTableGroups: [{ colLabels: ["Ki Points"], rows: [[2], [3]] }],
    });

    expect(column!.values).toHaveLength(20);
    expect(column!.values.at(-1)).toBe("—");
  });

  it("formats the die and speed cells the Monk's table uses", () => {
    const columns = progressionColumns({
      classTableGroups: [
        {
          colLabels: ["Martial Arts", "Movement"],
          rows: [
            [
              { type: "dice", toRoll: [{ number: 1, faces: 4 }] },
              { type: "bonusSpeed", value: 0 },
            ],
            [
              { type: "dice", toRoll: [{ number: 1, faces: 6 }] },
              { type: "bonusSpeed", value: 10 },
            ],
          ],
        },
      ],
    });

    expect(columns[0]!.values.slice(0, 2)).toEqual(["1d4", "1d6"]);
    expect(columns[1]!.values.slice(0, 2)).toEqual(["—", "+10 ft."]);
  });

  it("has no columns for a class that adds none", () => {
    expect(progressionColumns({ name: "Fighter" })).toEqual([]);
    expect(progressionColumns(null)).toEqual([]);
  });
});

describe("featureOrder", () => {
  const FIGHTER = {
    classFeatures: [
      "Fighting Style|Fighter||1",
      "Second Wind|Fighter||1",
      { classFeature: "Martial Archetype|Fighter||3", gainSubclassFeature: true },
    ],
  };

  it("reads the printed order out of the reference strings", () => {
    expect([...featureOrder(FIGHTER)]).toEqual([
      ["Fighting Style", 0],
      ["Second Wind", 1],
      ["Martial Archetype", 2],
    ]);
  });

  /**
   * The query can only order by level, which leaves same-level features in
   * whatever order the database returns them. This is what puts them back.
   */
  it("sorts features by level, then by the order the class prints them", () => {
    const features = [
      { name: "Second Wind", level: 1 },
      { name: "Martial Archetype", level: 3 },
      { name: "Fighting Style", level: 1 },
    ];

    expect(
      [...features].sort(byPrintedOrder(featureOrder(FIGHTER))).map((f) => f.name),
    ).toEqual(["Fighting Style", "Second Wind", "Martial Archetype"]);
  });

  /** A later book's addition is not in the array, and must not lead the level. */
  it("puts an unlisted feature after the ones the class names", () => {
    const features = [
      { name: "Martial Versatility", level: 1 },
      { name: "Second Wind", level: 1 },
    ];

    expect(
      [...features].sort(byPrintedOrder(featureOrder(FIGHTER))).map((f) => f.name),
    ).toEqual(["Second Wind", "Martial Versatility"]);
  });
});

describe("proficiencyLines", () => {
  it("reads the four lines a class starts with", () => {
    const lines = proficiencyLines({
      startingProficiencies: {
        armor: ["light", "medium", "heavy", "shield"],
        weapons: ["simple", "martial"],
        toolProficiencies: { "thieves' tools": true },
        skills: [
          { choose: { from: ["athletics", "sleight of hand"], count: 2 } },
        ],
      },
    });

    expect(lines).toEqual([
      {
        label: "Armor",
        value: "Light armor, medium armor, heavy armor, shields",
      },
      { label: "Weapons", value: "Simple weapons, martial weapons" },
      { label: "Tools", value: "Thieves' Tools" },
      {
        label: "Skills",
        value: "Choose two from Athletics, Sleight of Hand",
      },
    ]);
  });

  /** The Druid's shields carry their own caveat instead of a keyword. */
  it("prefers a grant's own wording over the keyword", () => {
    const [armor] = proficiencyLines({
      startingProficiencies: {
        armor: [
          { proficiency: "shield", full: "shields (druids will not wear metal)" },
        ],
      },
    });

    expect(armor!.value).toBe("Shields (druids will not wear metal)");
  });

  it("counts an open choice of tools and of skills", () => {
    const lines = proficiencyLines({
      startingProficiencies: {
        toolProficiencies: { anyMusicalInstrument: 3 },
        skills: [{ any: 3 }],
      },
    });

    expect(lines.map((line) => line.value)).toEqual([
      "Three musical instruments of your choice",
      "Choose any three",
    ]);
  });

  /** A line with nothing behind it is dropped, not printed as "None". */
  it("omits what a class has no proficiency in", () => {
    const lines = proficiencyLines({
      startingProficiencies: { weapons: ["simple"] },
    });

    expect(lines.map((line) => line.label)).toEqual(["Weapons"]);
    expect(proficiencyLines({})).toEqual([]);
  });
});

describe("startingEquipment", () => {
  it("takes the lines as written, tags and all", () => {
    expect(
      startingEquipment({
        startingEquipment: {
          default: ["(a) {@item chain mail|phb} or (b) leather armor"],
          defaultData: [{ a: ["chain mail|phb"] }],
        },
      }),
    ).toEqual(["(a) {@item chain mail|phb} or (b) leather armor"]);
  });

  it("has none for a class that lists none", () => {
    expect(startingEquipment({})).toEqual([]);
  });
});

/**
 * The books compose features out of other features, which are stored as
 * siblings rather than as children. Addressing one has to produce the key it is
 * stored under, or a page prints "Guardian" and "Infiltrator" as features in
 * their own right with nothing to say what they are models of.
 */
describe("features referenced by other features", () => {
  const ARMOR_MODEL = {
    type: "refSubclassFeature",
    subclassFeature: "Guardian|Artificer|TCE|Armorer|TCE|15",
  };

  it("addresses a subclass feature by the key it is stored under", () => {
    expect(featureReferenceKey(ARMOR_MODEL)).toBe(
      "subclassfeature|guardian|artificer|tce|armorer|tce|15|tce",
    );
  });

  it("addresses a class feature the same way", () => {
    expect(
      featureReferenceKey({
        type: "refClassFeature",
        classFeature: "Infusions Known|Artificer|TCE|2",
      }),
    ).toBe("classfeature|infusions known|artificer|tce|2|tce");
  });

  it("has no key for an entry that references nothing", () => {
    expect(featureReferenceKey({ type: "entries" })).toBeNull();
    expect(featureReferenceKey(null)).toBeNull();
  });

  it("finds every reference at any depth", () => {
    expect([
      ...collectFeatureReferences({
        entries: ["Your armor gains benefits.", ARMOR_MODEL],
      }),
    ]).toEqual(["subclassfeature|guardian|artificer|tce|armorer|tce|15|tce"]);
  });

  it("indexes loaded features by key, so a reference resolves without a query", () => {
    const index = indexFeatures([
      {
        naturalKey: "subclassfeature|guardian|artificer|tce|armorer|tce|15|tce",
        name: "Guardian",
        data: { entries: ["Your armor bristles."] },
      },
    ]);

    expect(index[featureReferenceKey(ARMOR_MODEL)!]).toEqual({
      name: "Guardian",
      entries: ["Your armor bristles."],
    });
  });
});

describe("descriptionEntries", () => {
  /**
   * Every class wraps its description in a section named after itself, which on
   * a page already titled with that name is a heading repeating the one above.
   */
  it("unwraps the section named after the class", () => {
    expect(
      descriptionEntries(
        {
          entries: [
            { type: "section", name: "Wizard", entries: ["Prose.", { name: "Creating a Wizard" }] },
            { type: "section", entries: ["More."] },
          ],
        },
        "Wizard",
        "PHB",
      ),
    ).toEqual([
      "Prose.",
      { name: "Creating a Wizard" },
      { type: "section", entries: ["More."] },
    ]);
  });

  it("leaves a section named anything else alone", () => {
    const fluff = { entries: [{ name: "Scholars", entries: ["Prose."] }] };

    expect(descriptionEntries(fluff, "Wizard", "PHB")).toEqual(fluff.entries);
    expect(descriptionEntries(null, "Wizard", "PHB")).toEqual([]);
  });

  /**
   * Every class carries a supplement's take on it in the same fluff record —
   * pages of Xanathar's roleplaying tables for the PHB twelve. A page about the
   * PHB Warlock prints the PHB's Warlock.
   */
  it("drops sections printed by another book", () => {
    const fluff = {
      entries: [
        { type: "section", name: "Wizard", source: "PHB", entries: ["Prose."] },
        { type: "section", source: "XGE", entries: ["Your Wizard's life."] },
      ],
    };

    expect(descriptionEntries(fluff, "Wizard", "PHB")).toEqual(["Prose."]);
    expect(descriptionEntries(fluff, "Wizard", "phb")).toEqual(["Prose."]);
  });
});
