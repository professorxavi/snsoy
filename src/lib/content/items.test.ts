import { describe, expect, it } from "vitest";
import {
  applyBaseName,
  applyItemPlaceholders,
  attunementPhrase,
  baseItemName,
  bareCode,
  formatDamage,
  formatItemArmorClass,
  formatItemTypeLine,
  formatItemValue,
  formatProperties,
  formatWeight,
  itemEntryKey,
  itemTypeName,
  parseItemEntryTag,
  rarityColumnLabel,
  rarityPhrase,
  rarityRank,
  RARITY_ORDER,
  resolveItemEntries,
} from "./items";

/**
 * The item formatters, checked against what the books print.
 *
 * Every expectation here is a line someone can look up in an equipment table or
 * a magic item entry, which is what makes them worth pinning: these are not our
 * wording, they are the corpus's, and a change that makes one of them read
 * differently is a regression rather than a preference.
 *
 * The corpus-wide runs — every branch exercised over all 3,645 items — live in
 * `items.smoke.test.ts`, which needs the database.
 */

/** The corpus's own `itemType` vocabulary, in miniature. */
const TYPES = new Map([
  ["M", "Melee Weapon"],
  ["LA", "Light Armor"],
  ["MA", "Medium Armor"],
  ["HA", "Heavy Armor"],
  ["S", "Shield"],
  ["RG", "Ring"],
  ["G", "Adventuring Gear"],
]);

const PROPERTIES = new Map([
  ["V", "Versatile"],
  ["F", "Finesse"],
  ["L", "Light"],
  ["T", "Thrown"],
  ["AF", "Ammunition"],
  ["2H", "Two-Handed"],
]);

describe("itemTypeName", () => {
  it("resolves an abbreviation through the corpus vocabulary", () => {
    expect(itemTypeName("M", TYPES)).toBe("Melee Weapon");
  });

  /** The 776 wondrous items, 29 staffs and 21 poisons the vocabulary omits. */
  it("resolves the synthetic types the vocabulary has no entry for", () => {
    expect(itemTypeName("WON", TYPES)).toBe("Wondrous Item");
    expect(itemTypeName("STF", TYPES)).toBe("Staff");
    expect(itemTypeName("PSN", TYPES)).toBe("Poison");
  });

  /** Visible and wrong beats invisible: a new book's type still shows. */
  it("returns an unknown abbreviation unchanged", () => {
    expect(itemTypeName("ZZ", TYPES)).toBe("ZZ");
  });

  it("is null for an item with no type at all", () => {
    expect(itemTypeName(null, TYPES)).toBeNull();
  });
});

describe("bareCode", () => {
  it("drops the source a reference carries", () => {
    expect(bareCode("AF|DMG")).toBe("AF");
    expect(bareCode("V")).toBe("V");
  });
});

describe("baseItemName", () => {
  it("reads a referenced base item, without its source", () => {
    expect(baseItemName({ baseItem: "longsword|phb" })).toBe("longsword");
  });

  /** How the 1,852 generated variants record the same fact. */
  it("falls back to the name a generated variant was built from", () => {
    expect(baseItemName({ _baseName: "Chain Shirt" })).toBe("chain shirt");
  });

  it("is null when the item was not built on anything", () => {
    expect(baseItemName({})).toBeNull();
  });
});

describe("rarityRank", () => {
  it("orders by power, which alphabetical order gets backwards", () => {
    const sorted = ["artifact", "uncommon", "very rare", "common"].sort(
      (a, b) => rarityRank(a) - rarityRank(b),
    );

    expect(sorted).toEqual(["common", "uncommon", "very rare", "artifact"]);
  });

  it("sorts an unrated item past every real rarity", () => {
    expect(rarityRank(null)).toBeGreaterThan(rarityRank("artifact"));
    expect(rarityRank("nonsense")).toBe(RARITY_ORDER.length);
  });
});

describe("rarityColumnLabel", () => {
  it("labels a real rarity", () => {
    expect(rarityColumnLabel("very rare")).toBe("Very rare");
  });

  /** 699 rows would otherwise read "None" or "Unknown" down a whole column. */
  it("empties the cell for an item with no rating", () => {
    expect(rarityColumnLabel("none")).toBe("—");
    expect(rarityColumnLabel("unknown")).toBe("—");
    expect(rarityColumnLabel(null)).toBe("—");
  });

  it("shortens the magical unknown, since the column is already headed", () => {
    expect(rarityColumnLabel("unknown (magic)")).toBe("Unknown");
  });
});

describe("rarityPhrase", () => {
  it("prints a real rarity as it is stored", () => {
    expect(rarityPhrase("very rare")).toBe("very rare");
  });

  /** "Adventuring Gear, none" describes an absence rather than the item. */
  it("says nothing for the mundane and the unrecorded", () => {
    expect(rarityPhrase("none")).toBeNull();
    expect(rarityPhrase("unknown")).toBeNull();
    expect(rarityPhrase(null)).toBeNull();
  });

  it("rewords the two that are not adjectives", () => {
    expect(rarityPhrase("varies")).toBe("rarity varies");
    expect(rarityPhrase("unknown (magic)")).toBe("rarity unknown");
  });
});

describe("attunementPhrase", () => {
  it("qualifies attunement where the item does", () => {
    expect(attunementPhrase(true)).toBe("requires attunement");
    expect(attunementPhrase("by a wizard")).toBe("requires attunement by a wizard");
  });

  /** Not a qualifier but a different statement: "attunement by optional". */
  it("treats optional attunement as its own wording", () => {
    expect(attunementPhrase("optional")).toBe("attunement optional");
  });

  it("is null when nothing is required", () => {
    expect(attunementPhrase(false)).toBeNull();
    expect(attunementPhrase(undefined)).toBeNull();
  });
});

describe("formatItemTypeLine", () => {
  it("reads as the line printed under a magic item's name", () => {
    expect(
      formatItemTypeLine({
        typeName: "Melee Weapon",
        baseName: "longsword",
        rarity: "rare",
        reqAttune: "by a spellcaster",
      }),
    ).toBe("Melee Weapon (longsword), rare (requires attunement by a spellcaster)");
  });

  it("drops the rarity of a mundane item rather than printing none", () => {
    expect(formatItemTypeLine({ typeName: "Adventuring Gear", rarity: "none" })).toBe(
      "Adventuring Gear",
    );
  });

  it("stands on the rarity alone when the type is unrecorded", () => {
    expect(formatItemTypeLine({ rarity: "legendary" })).toBe("legendary");
  });

  /** Eight items in the corpus have neither a type nor a printable rarity. */
  it("is empty when the item states nothing about itself", () => {
    expect(formatItemTypeLine({ rarity: "unknown (magic)" })).toBe("rarity unknown");
    expect(formatItemTypeLine({})).toBe("");
  });

  it("capitalises attunement when it opens the line", () => {
    expect(formatItemTypeLine({ reqAttune: true })).toBe("Requires attunement");
  });
});

describe("formatItemValue", () => {
  /** Values are stored in copper so mixed denominations sort against each other. */
  it("prints the largest coin that divides the value exactly", () => {
    expect(formatItemValue(1500)).toBe("15 gp");
    expect(formatItemValue(50)).toBe("5 sp");
    expect(formatItemValue(1)).toBe("1 cp");
  });

  it("groups thousands", () => {
    expect(formatItemValue(150000)).toBe("1,500 gp");
  });

  it("dashes an item with no recorded value", () => {
    expect(formatItemValue(null)).toBe("—");
  });
});

describe("formatWeight", () => {
  it("writes halves and quarters as the tables write them", () => {
    expect(formatWeight(0.5)).toBe("1/2 lb.");
    expect(formatWeight(0.25)).toBe("1/4 lb.");
    expect(formatWeight(1.5)).toBe("1 1/2 lb.");
  });

  it("prints whole pounds plainly", () => {
    expect(formatWeight(65)).toBe("65 lb.");
  });

  /** A sling bullet is 1/16 lb.; rounding it to 0.063 would be a lie. */
  it("keeps a fraction it cannot name to the precision it was given", () => {
    expect(formatWeight(0.0625)).toBe("0.0625 lb.");
    expect(formatWeight(0.02)).toBe("0.02 lb.");
  });

  it("dashes an item with no recorded weight", () => {
    expect(formatWeight(null)).toBe("—");
  });
});

describe("formatDamage", () => {
  it("names the damage type in full", () => {
    expect(formatDamage("1d8", "S")).toBe("1d8 slashing");
    expect(formatDamage("6d8", "N")).toBe("6d8 necrotic");
  });

  it("prints the dice alone when no type is recorded", () => {
    expect(formatDamage("1d6", null)).toBe("1d6");
  });

  it("is null for anything that deals no damage", () => {
    expect(formatDamage(null, "S")).toBeNull();
  });
});

describe("formatProperties", () => {
  it("expands the codes into the weapon table's own words", () => {
    expect(formatProperties(["F", "L"], PROPERTIES, {})).toBe("finesse, light");
  });

  /** The numbers these three carry live elsewhere on the item. */
  it("carries the versatile die and the thrown range into the line", () => {
    expect(formatProperties(["V"], PROPERTIES, { dmg2: "1d10" })).toBe(
      "versatile (1d10)",
    );
    expect(formatProperties(["T"], PROPERTIES, { range: "20/60" })).toBe(
      "thrown (range 20/60)",
    );
    expect(formatProperties(["AF|DMG"], PROPERTIES, { range: "80/320" })).toBe(
      "ammunition (range 80/320)",
    );
  });

  it("is empty for an item with no properties", () => {
    expect(formatProperties(null, PROPERTIES, {})).toBe("");
  });
});

describe("applyBaseName", () => {
  /**
   * The exact sentence four items in the corpus reach the renderer with. It is
   * one paragraph shared by every weapon the slaying variant applies to, which
   * is why it is written in placeholders rather than words.
   */
  it("resolves the sentence a magic-variant template writes", () => {
    expect(
      applyBaseName(
        "{=baseName/at} {=baseName/l} of slaying is a magic weapon.",
        "Arrow",
      ),
    ).toBe("An arrow of slaying is a magic weapon.");
  });

  it("applies each modifier the corpus uses", () => {
    expect(applyBaseName("{=baseName/l}", "Crossbow Bolt")).toBe("crossbow bolt");
    expect(applyBaseName("{=baseName/u}", "Arrow")).toBe("ARROW");
    expect(applyBaseName("{=baseName/t}", "crossbow bolt")).toBe("Crossbow Bolt");
    expect(applyBaseName("{=baseName}", "Arrow")).toBe("Arrow");
  });

  /** The `a` modifier replaces the name with its article, it does not prefix it. */
  it("chooses the article the name takes", () => {
    expect(applyBaseName("{=baseName/a}", "Arrow")).toBe("an");
    expect(applyBaseName("{=baseName/a}", "Crossbow Bolt")).toBe("a");
  });

  it("leaves text with no placeholder untouched", () => {
    expect(applyBaseName("An ordinary sentence.", "Arrow")).toBe(
      "An ordinary sentence.",
    );
  });
});

describe("formatItemArmorClass", () => {
  it("adds what each armour class of armour adds", () => {
    expect(formatItemArmorClass(18, "HA")).toBe("18");
    expect(formatItemArmorClass(11, "LA")).toBe("11 + Dex modifier");
    expect(formatItemArmorClass(14, "MA")).toBe("14 + Dex modifier (max 2)");
  });

  /** Serpent Scale Armor is medium armour with the cap explicitly removed. */
  it("drops the cap where the item sets it to null", () => {
    expect(formatItemArmorClass(14, "MA", { dexterityMax: null })).toBe(
      "14 + Dex modifier",
    );
  });

  it("prints a shield as the bonus it is, not an armour class", () => {
    expect(formatItemArmorClass(2, "S")).toBe("+2");
  });

  it("is null for anything that grants no armour class", () => {
    expect(formatItemArmorClass(null, "HA")).toBeNull();
  });
});

/**
 * The shared descriptions 170 items cite instead of repeating.
 *
 * Every fixture here is a real citation and a real template, trimmed. What
 * makes them worth pinning is that the failure mode is silent: a citation that
 * does not resolve prints `{#itemEntry Potion of Resistance}` where the whole
 * description belongs, and nothing else about the item looks wrong.
 */

const RESISTANCE = ["You have resistance to {{item.resist}} damage while you wear this armor."];

const TEMPLATES = new Map<string, unknown[]>([
  ["armor of resistance|dmg", RESISTANCE],
  ["absorbing tattoo|tce", [
    "Produced by a special needle, this magic tattoo features designs that emphasize one color ({{item.detail1}}).",
    {
      name: "Damage Resistance",
      type: "entries",
      entries: ["While the tattoo is on your skin, you have resistance to {{item.resist}} damage."],
    },
  ]],
]);

describe("parseItemEntryTag", () => {
  it("reads both forms the corpus writes", () => {
    expect(parseItemEntryTag("{#itemEntry Potion of Resistance}")).toEqual({
      name: "Potion of Resistance",
      source: null,
    });
    expect(parseItemEntryTag("{#itemEntry Absorbing Tattoo|TCE}")).toEqual({
      name: "Absorbing Tattoo",
      source: "TCE",
    });
  });

  /**
   * All 170 citations are a whole element of `entries`, so a string that merely
   * contains one is prose that happens to mention it, not a citation.
   */
  it("matches a whole string, never part of one", () => {
    expect(parseItemEntryTag("See {#itemEntry Grenade|DMG} below.")).toBeNull();
    expect(parseItemEntryTag("Ordinary prose.")).toBeNull();
  });
});

describe("itemEntryKey", () => {
  /** A citation with no source means the book it is written in. */
  it("falls back to the citing item's own source", () => {
    expect(itemEntryKey("Potion of Resistance", null, "DMG")).toBe(
      "potion of resistance|dmg",
    );
    expect(itemEntryKey("Grenade", "DMG", "QftIS")).toBe("grenade|dmg");
  });
});

describe("applyItemPlaceholders", () => {
  it("fills a placeholder from the citing item", () => {
    expect(
      applyItemPlaceholders("resistance to {{item.resist}} damage", {
        resist: ["fire"],
      }),
    ).toBe("resistance to fire damage");
  });

  it("substitutes nothing for a value the item does not carry", () => {
    expect(applyItemPlaceholders("one color ({{item.detail1}})", {})).toBe(
      "one color ()",
    );
  });

  it("leaves text with no placeholder untouched", () => {
    expect(applyItemPlaceholders("An ordinary sentence.", {})).toBe(
      "An ordinary sentence.",
    );
  });
});

describe("resolveItemEntries", () => {
  /** The 36 items whose citation is the whole of what they say. */
  it("replaces a description that is nothing but a citation", () => {
    expect(
      resolveItemEntries(
        ["{#itemEntry Armor of Resistance}"],
        { source: "DMG", resist: ["fire"] },
        TEMPLATES,
      ),
    ).toEqual(["You have resistance to fire damage while you wear this armor."]);
  });

  /** The 134 that keep their base item's paragraph and cite the second. */
  it("replaces one paragraph and leaves the other standing", () => {
    expect(
      resolveItemEntries(
        ["Plate consists of shaped, interlocking metal plates.", "{#itemEntry Armor of Resistance}"],
        { source: "DMG", resist: ["acid"] },
        TEMPLATES,
      ),
    ).toEqual([
      "Plate consists of shaped, interlocking metal plates.",
      "You have resistance to acid damage while you wear this armor.",
    ]);
  });

  /** A template is a list of entries, so it is spliced in, not nested. */
  it("splices a multi-entry template, filling it throughout", () => {
    expect(
      resolveItemEntries(
        ["{#itemEntry Absorbing Tattoo|TCE}"],
        { source: "TCE", resist: ["acid"], detail1: "green" },
        TEMPLATES,
      ),
    ).toEqual([
      "Produced by a special needle, this magic tattoo features designs that emphasize one color (green).",
      {
        name: "Damage Resistance",
        type: "entries",
        entries: ["While the tattoo is on your skin, you have resistance to acid damage."],
      },
    ]);
  });

  /** Printing the markup is the thing this exists to stop. */
  it("drops a citation naming a template that does not exist", () => {
    expect(
      resolveItemEntries(["{#itemEntry No Such Thing}"], { source: "DMG" }, TEMPLATES),
    ).toEqual([]);
  });

  it("leaves entries with no citation exactly as they were", () => {
    const entries = ["Ordinary prose.", { type: "entries", entries: ["More."] }];

    expect(resolveItemEntries(entries, { source: "DMG" }, TEMPLATES)).toEqual(entries);
  });

  /** 1,562 items have no `entries` key at all. */
  it("passes through anything that is not an array", () => {
    expect(resolveItemEntries(undefined, { source: "DMG" }, TEMPLATES)).toBeUndefined();
  });
});
