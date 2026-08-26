import { describe, expect, it } from "vitest";
import {
  abilityScores,
  formatAlignment,
  formatArmorClass,
  formatChallenge,
  formatCreatureLine,
  formatCreatureType,
  formatDefences,
  formatHitPoints,
  formatLanguages,
  formatSaves,
  formatSenses,
  formatSize,
  formatSkills,
  formatSpeed,
  legendaryIntro,
  spellFrequencyLabel,
  spellLevelLabel,
} from "./monsters";

/**
 * The header of a stat block, which is where nearly all of a creature's data
 * variation lives — the traits and actions below it are prose the shared entry
 * renderer already handles.
 *
 * Every fixture here is a shape taken from the books rather than invented, and
 * the counts in the test names are how many of the 3,628 creatures take that
 * branch. That is the point of the file: none of these are edge cases in the
 * sense of being unlikely, they are simply the less common of the shapes the
 * data actually uses, and each of them prints as nonsense if handled as if it
 * were the common one.
 */

describe("formatSize", () => {
  it("names the code", () => {
    expect(formatSize(["H"])).toBe("Huge");
  });

  /** 56 creatures are printed at either of two sizes. */
  it("joins the two sizes a creature may be", () => {
    expect(formatSize(["S", "M"])).toBe("Small or Medium");
  });

  it("has nothing to say about a creature with no size", () => {
    expect(formatSize(undefined)).toBe("");
  });
});

describe("formatCreatureType", () => {
  it("passes a bare type through", () => {
    expect(formatCreatureType("dragon")).toBe("dragon");
  });

  /** 1,556 creatures qualify their type. */
  it("prints the tags in parentheses", () => {
    expect(formatCreatureType({ type: "humanoid", tags: ["half-elf"] })).toBe(
      "humanoid (half-elf)",
    );
  });

  it("keeps a tag's prefix with it", () => {
    expect(
      formatCreatureType({
        type: "humanoid",
        tags: [{ prefix: "any", tag: "race" }],
      }),
    ).toBe("humanoid (any race)");
  });

  /**
   * A swarm describes the size of its members, not its own — which is why this
   * cannot be composed from the size and the type independently.
   */
  it("describes a swarm by what is in it", () => {
    expect(formatCreatureType({ type: "beast", swarmSize: "T" })).toBe(
      "swarm of Tiny beasts",
    );
  });
});

describe("formatAlignment", () => {
  it("reads the two codes as words", () => {
    expect(formatAlignment(["C", "E"])).toBe("chaotic evil");
  });

  it("names the single-code alignments", () => {
    expect(formatAlignment(["U"])).toBe("unaligned");
    expect(formatAlignment(["N"])).toBe("neutral");
    expect(formatAlignment(["A"])).toBe("any alignment");
  });

  /**
   * A range is stored as every code it covers, so "any evil" is the whole law
   * axis plus evil. Read literally it would come out as "lawful neutral chaotic
   * evil", which is the failure this exists to catch.
   */
  it("collapses a whole axis into 'any'", () => {
    expect(formatAlignment(["L", "NX", "C", "E"])).toBe("any evil alignment");
    expect(formatAlignment(["C", "G", "NY", "E"])).toBe(
      "any chaotic alignment",
    );
  });

  /** Five of the six codes is the whole spread except the one left out. */
  it("names the missing code when five of six are present", () => {
    expect(formatAlignment(["L", "NX", "C", "NY", "E"])).toBe(
      "any non-good alignment",
    );
    expect(formatAlignment(["NX", "C", "G", "NY", "E"])).toBe(
      "any non-lawful alignment",
    );
  });

  /** 497 creatures state a tendency rather than a rule. */
  it("keeps the prefix, lowercased", () => {
    expect(formatAlignment(["C", "E"], "Typically")).toBe(
      "typically chaotic evil",
    );
  });

  it("prints a rolled alignment as its odds", () => {
    expect(
      formatAlignment([
        { chance: 50, alignment: ["N", "G"] },
        { chance: 50, alignment: ["N", "E"] },
      ]),
    ).toBe("50% neutral good, 50% neutral evil");
  });

  it("offers un-weighted options as alternatives", () => {
    expect(
      formatAlignment([{ alignment: ["N", "G"] }, { alignment: ["N", "E"] }]),
    ).toBe("neutral good or neutral evil");
  });

  it("takes a special alignment at its word", () => {
    expect(formatAlignment([{ special: "lawful grumpy" }])).toBe(
      "lawful grumpy",
    );
  });

  it("keeps the note that qualifies an alignment", () => {
    expect(
      formatAlignment([
        { alignment: ["C", "G"], note: "chaotic evil when fully possessed" },
      ]),
    ).toBe("chaotic good (chaotic evil when fully possessed)");
  });
});

describe("formatCreatureLine", () => {
  it("reads as the line under the name", () => {
    expect(
      formatCreatureLine({
        size: ["H"],
        type: "dragon",
        alignment: ["C", "E"],
      }),
    ).toBe("Huge dragon, chaotic evil");
  });

  /** The swarm's own size first, its members' second. */
  it("gives a swarm both sizes", () => {
    expect(
      formatCreatureLine({
        size: ["M"],
        type: { type: "beast", swarmSize: "T" },
        alignment: ["U"],
      }),
    ).toBe("Medium swarm of Tiny beasts, unaligned");
  });

  it("omits the comma when there is no alignment", () => {
    expect(formatCreatureLine({ size: ["M"], type: "humanoid" })).toBe(
      "Medium humanoid",
    );
  });
});

describe("formatArmorClass", () => {
  it("names what the armour comes from", () => {
    expect(formatArmorClass([{ ac: 19, from: ["natural armor"] }])).toBe(
      "19 (natural armor)",
    );
  });

  it("prints a bare number alone", () => {
    expect(formatArmorClass([12])).toBe("12");
  });

  /**
   * 197 creatures have a spell-raised AC. `braces` is the whole difference
   * between "13 (16 with mage armor)" and "13, 16 with mage armor", and the
   * the books set it per entry.
   */
  it("braces a conditional AC when the data says to", () => {
    expect(
      formatArmorClass([
        13,
        { ac: 16, braces: true, condition: "with {@spell mage armor}" },
      ]),
    ).toBe("13 (16 with {@spell mage armor})");
  });

  it("commas an unbraced alternative instead", () => {
    expect(
      formatArmorClass([
        { ac: 11, condition: "in humanoid form" },
        { ac: 12, from: ["natural armor"], condition: "in wolf or hybrid form" },
      ]),
    ).toBe("11 in humanoid form, 12 (natural armor) in wolf or hybrid form");
  });

  /** 15 creatures have an AC that is a formula rather than a number. */
  it("passes a special AC through whole", () => {
    expect(formatArmorClass([{ special: "13 + PB (natural armor)" }])).toBe(
      "13 + PB (natural armor)",
    );
  });

  it("falls back to a dash with nothing to print", () => {
    expect(formatArmorClass(undefined)).toBe("—");
    expect(formatArmorClass([])).toBe("—");
  });
});

describe("formatHitPoints", () => {
  it("prints the average and the dice behind it", () => {
    expect(formatHitPoints({ average: 256, formula: "19d12 + 133" })).toBe(
      "256 (19d12 + 133)",
    );
  });

  /** 44 creatures state their hit points in words. */
  it("prefers a special value to the numbers", () => {
    expect(
      formatHitPoints({ special: "40 + 10 for each spell level above 4th" }),
    ).toBe("40 + 10 for each spell level above 4th");
  });

  it("prints an average with no formula on its own", () => {
    expect(formatHitPoints({ average: 30 })).toBe("30");
  });
});

describe("formatSpeed", () => {
  /** Walk is the default mode and goes unnamed, as the book prints it. */
  it("leaves the walking speed unlabelled and names the rest", () => {
    expect(formatSpeed({ walk: 40, climb: 40, fly: 80 })).toBe(
      "40 ft., climb 40 ft., fly 80 ft.",
    );
  });

  it("keeps a speed's condition with it", () => {
    expect(
      formatSpeed({
        walk: 30,
        fly: { number: 30, condition: "(hover)" },
        canHover: true,
      }),
    ).toBe("30 ft., fly 30 ft. (hover)");
  });

  /**
   * `canHover` is already said by the fly speed's own condition. Printing both
   * gives "fly 30 ft. (hover) (hover)", which is what this pins down.
   */
  it("does not repeat hovering", () => {
    const line = formatSpeed({
      walk: 0,
      fly: { number: 30, condition: "(hover)" },
      canHover: true,
    });

    expect(line.match(/hover/g)).toHaveLength(1);
  });

  it("keeps a walk speed of zero, which is a fact about the creature", () => {
    expect(formatSpeed({ walk: 0, swim: 40 })).toBe("0 ft., swim 40 ft.");
  });

  it("orders the modes the way print does, not the way the data does", () => {
    expect(formatSpeed({ swim: 30, burrow: 20, walk: 10 })).toBe(
      "10 ft., burrow 20 ft., swim 30 ft.",
    );
  });
});

describe("formatDefences", () => {
  it("lists plain damage types", () => {
    expect(formatDefences(["fire", "poison"], "immune")).toBe("fire, poison");
  });

  /**
   * The wrapper names its types after the defence it belongs to, which is why
   * the key has to be passed in — read from the wrong key it yields nothing.
   */
  it("qualifies a conditional group with its note", () => {
    expect(
      formatDefences(
        [
          "cold",
          {
            cond: true,
            note: "from nonmagical attacks",
            resist: ["bludgeoning", "piercing", "slashing"],
          },
        ],
        "resist",
      ),
    ).toBe("cold; bludgeoning, piercing, slashing from nonmagical attacks");
  });

  it("puts a preNote before the types", () => {
    expect(
      formatDefences(
        [
          {
            cond: true,
            preNote: "nonmagical",
            note: "(from stoneskin)",
            resist: ["bludgeoning", "piercing", "slashing"],
          },
        ],
        "resist",
      ),
    ).toBe("nonmagical bludgeoning, piercing, slashing (from stoneskin)");
  });

  it("passes a special defence through", () => {
    expect(formatDefences([{ special: "damage from spells" }], "resist")).toBe(
      "damage from spells",
    );
  });

  /**
   * Vecna's, and the only creature shaped this way. A group with no note of its
   * own is not a separate clause — it is more damage types — so it joins the
   * run rather than starting a new one after a semicolon.
   */
  it("keeps an unqualified group in the same run", () => {
    expect(
      formatDefences(
        [
          {
            cond: true,
            note: "from nonmagical attacks",
            immune: ["bludgeoning"],
          },
          { immune: ["necrotic", "poison"] },
        ],
        "immune",
      ),
    ).toBe("bludgeoning from nonmagical attacks; necrotic, poison");
  });

  /** Absent is not the same as empty: the line is omitted, not printed blank. */
  it("gives back nothing when the creature has none", () => {
    expect(formatDefences(undefined, "immune")).toBe("");
    expect(formatDefences([], "immune")).toBe("");
  });
});

describe("formatSenses", () => {
  /** Passive Perception is stored apart but printed inside the senses. */
  it("ends on passive Perception", () => {
    expect(formatSenses(["blindsight 60 ft."], 23)).toBe(
      "blindsight 60 ft., passive Perception 23",
    );
  });

  it("prints passive Perception alone when there are no other senses", () => {
    expect(formatSenses(undefined, 10)).toBe("passive Perception 10");
  });
});

describe("formatLanguages", () => {
  it("joins them", () => {
    expect(formatLanguages(["Common", "Draconic"])).toBe("Common, Draconic");
  });

  it("dashes when a creature speaks nothing", () => {
    expect(formatLanguages(undefined)).toBe("—");
  });
});

describe("abilityScores", () => {
  it("derives the modifier from the score", () => {
    const scores = abilityScores({ str: 27, dex: 10, con: 25 });

    expect(scores.map((s) => s.modifier)).toEqual([
      "+8",
      "+0",
      "+7",
      null,
      null,
      null,
    ]);
  });

  it("keeps the six in their printed order whatever order they arrive in", () => {
    expect(abilityScores({ cha: 1, str: 2 }).map((s) => s.ability)).toEqual([
      "str",
      "dex",
      "con",
      "int",
      "wis",
      "cha",
    ]);
  });

  it("marks an absent score rather than inventing a zero", () => {
    expect(abilityScores({}).every((s) => s.score === null)).toBe(true);
  });
});

describe("formatSaves", () => {
  /** The data's key order is arbitrary; the printed order is not. */
  it("prints the saves in ability order", () => {
    expect(formatSaves({ wis: "+7", con: "+13", dex: "+6" })).toBe(
      "Dex +6, Con +13, Wis +7",
    );
  });

  it("says nothing when a creature is proficient in none", () => {
    expect(formatSaves(undefined)).toBe("");
  });
});

describe("formatSkills", () => {
  it("title-cases and alphabetises", () => {
    expect(formatSkills({ stealth: "+6", perception: "+13" })).toBe(
      "Perception +13, Stealth +6",
    );
  });

  it("reads an underscored key as words", () => {
    expect(formatSkills({ animal_handling: "+5" })).toBe(
      "Animal Handling +5",
    );
  });
});

describe("formatChallenge", () => {
  it("adds the experience the rating is worth", () => {
    expect(formatChallenge("17")).toBe("17 (18,000 XP)");
  });

  it("groups the digits", () => {
    expect(formatChallenge("30")).toBe("30 (155,000 XP)");
  });

  it("handles the fractional ratings", () => {
    expect(formatChallenge("1/8")).toBe("1/8 (25 XP)");
  });

  /** 44 creatures are rated higher in their lair. */
  it("prints the lair rating after the base one", () => {
    expect(formatChallenge({ cr: "15", lair: "16" })).toBe(
      "15 (13,000 XP) or 16 (15,000 XP) while in its lair",
    );
  });

  it("prints a coven rating the same way", () => {
    expect(formatChallenge({ cr: "5", coven: "7" })).toBe(
      "5 (1,800 XP) or 7 (2,900 XP) while in a coven",
    );
  });

  /** Four creatures are rated 0 and worth nothing, against the table's 10. */
  it("lets an explicit award beat the table", () => {
    expect(formatChallenge({ cr: "0", xp: 0 })).toBe("0 (0 XP)");
  });

  it("prints an unrated creature as a dash", () => {
    expect(formatChallenge(undefined)).toBe("—");
  });

  it("passes an unknown rating through rather than inventing experience", () => {
    expect(formatChallenge("Unknown")).toBe("Unknown");
  });
});

describe("legendaryIntro", () => {
  /**
   * Synthesised for 341 of the 351 creatures with legendary actions, so the
   * wording is the display for nearly all of them rather than a fallback.
   */
  it("names the creature the way its own prose does", () => {
    const intro = legendaryIntro({ name: "Adult Red Dragon" });

    expect(intro).toContain("The dragon can take 3 legendary actions");
    expect(intro).toContain("at the start of its turn");
  });

  it("uses a named creature's own name and avoids calling it 'it'", () => {
    const intro = legendaryIntro({ name: "Strahd von Zarovich", isNamedCreature: true });

    expect(intro).toContain("Strahd can take 3 legendary actions");
    expect(intro).toContain("at the start of their turn");
  });

  it("takes the count from the creature where it differs", () => {
    expect(legendaryIntro({ name: "Tiamat", legendaryActions: 5 })).toContain(
      "can take 5 legendary actions",
    );
  });

  it("keeps the sentence singular for a single action", () => {
    expect(legendaryIntro({ name: "Bat", legendaryActions: 1 })).toContain(
      "can take 1 legendary action,",
    );
  });
});

describe("spellFrequencyLabel", () => {
  /** "1e" is one casting of each spell, "2" two castings shared between them. */
  it("reads the 'each' suffix", () => {
    expect(spellFrequencyLabel("1e", "day")).toBe("1/day each");
    expect(spellFrequencyLabel("2", "day")).toBe("2/day");
    expect(spellFrequencyLabel("3e", "rest")).toBe("3/rest each");
  });
});

describe("spellLevelLabel", () => {
  it("calls level zero cantrips", () => {
    expect(spellLevelLabel("0")).toBe("Cantrips (at will)");
  });

  it("counts the slots", () => {
    expect(spellLevelLabel("1", 4)).toBe("1st level (4 slots)");
    expect(spellLevelLabel("3", 3)).toBe("3rd level (3 slots)");
    expect(spellLevelLabel("2", 1)).toBe("2nd level (1 slot)");
  });

  it("omits the count where the data gives none", () => {
    expect(spellLevelLabel("4")).toBe("4th level");
  });
});
