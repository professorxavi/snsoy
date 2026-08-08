import { describe, expect, it } from "vitest";
import {
  candidateKeysForStatblock,
  candidateKeysForTag,
  collectReferences,
  kindOfTag,
  labelForTag,
  lookupReference,
  parentKeyFor,
} from "./references";
import { parseTag } from "./tags";

/**
 * Every expectation here is a real tag string, and the natural keys are ones
 * actually present in the database. The resolver was also checked wholesale
 * against the `entity_links` ingest resolved from the same text; these tests
 * pin the cases where the two initially disagreed.
 */

const tag = (raw: string) => parseTag(raw);

describe("kindOfTag", () => {
  it("separates the three rendered treatments", () => {
    expect(kindOfTag("spell")).toBe("reference");
    expect(kindOfTag("damage")).toBe("roll");
    expect(kindOfTag("b")).toBe("format");
  });

  it("treats deferred tags as known, so they stay out of the coverage report", () => {
    expect(kindOfTag("filter")).toBe("plain");
    expect(kindOfTag("quickref")).toBe("plain");
  });

  it("reports anything else as a gap", () => {
    expect(kindOfTag("somethingNew")).toBe("unknown");
  });
});

describe("candidateKeysForTag", () => {
  it("uses the default source when the tag omits one", () => {
    expect(candidateKeysForTag(tag("{@spell fireball}"))).toEqual([
      "spell|fireball|phb",
    ]);
    // An unqualified creature is from the Monster Manual, not the PHB.
    expect(candidateKeysForTag(tag("{@creature bat}"))).toEqual([
      "monster|bat|mm",
    ]);
  });

  it("maps the tag vocabulary onto the entity vocabulary", () => {
    // {@creature} addresses a `monster`; the two names are not the same.
    expect(candidateKeysForTag(tag("{@creature goblin|MM}"))[0]).toBe(
      "monster|goblin|mm",
    );
  });

  it("treats an empty source part as absent rather than as an empty source", () => {
    // "{@condition blinded||blind}" — the empty middle part is a placeholder
    // so a display override can be supplied without restating the source.
    expect(candidateKeysForTag(tag("{@condition blinded||blind}"))).toEqual([
      "condition|blinded|phb",
    ]);
  });

  /**
   * `{@item club|phb}` is a `baseitem`, not an `item` — mundane gear, magic
   * items and item groups all share one tag.
   */
  it("offers every type an item tag might address", () => {
    expect(candidateKeysForTag(tag("{@item club|phb}"))).toEqual([
      "item|club|phb",
      "baseitem|club|phb",
      "itemgroup|club|phb",
    ]);
  });

  /**
   * `{@race dwarf (hill)}` addresses the subrace `subrace|hill|dwarf|phb|phb`.
   */
  it("recognises the parenthesised subrace form", () => {
    expect(candidateKeysForTag(tag("{@race dwarf (hill)||Dwarf, hill}"))).toEqual(
      ["race|dwarf (hill)|phb", "subrace|hill|dwarf|phb|phb"],
    );
  });

  it("leaves an unqualified race alone", () => {
    expect(candidateKeysForTag(tag("{@race Dragonborn}"))).toEqual([
      "race|dragonborn|phb",
    ]);
  });

  it("builds the multi-part key a class feature needs", () => {
    expect(candidateKeysForTag(tag("{@classFeature Divine Sense|Paladin|PHB|1}"))).toEqual(
      ["classfeature|divine sense|paladin|phb|1|phb"],
    );
  });

  /** The chapter index belongs in the key; it must never reach a URL. */
  it("addresses a book section by source and chapter index", () => {
    expect(
      candidateKeysForTag(tag("{@book school of magic|PHB|10|The Schools of Magic}")),
    ).toEqual(["booksection|phb|10"]);
    expect(candidateKeysForTag(tag("{@adventure appendix C|IDRotF|21}"))).toEqual([
      "booksection|idrotf|21",
    ]);
  });

  it("yields nothing for tags that address no entity", () => {
    expect(candidateKeysForTag(tag("{@damage 8d6}"))).toEqual([]);
    expect(candidateKeysForTag(tag("{@filter fey|bestiary|type=fey}"))).toEqual([]);
  });
});

describe("labelForTag", () => {
  it("honours a display override so prose stays grammatical", () => {
    expect(labelForTag(tag("{@condition deafened||deafens}"))).toBe("deafens");
    expect(labelForTag(tag("{@creature dretch||dretches}"))).toBe("dretches");
  });

  it("falls back to the entity name when no override is given", () => {
    expect(labelForTag(tag("{@condition blinded}"))).toBe("blinded");
  });

  it("puts the display text first for tags that address by index", () => {
    expect(labelForTag(tag("{@book school of magic|PHB|10|The Schools of Magic}"))).toBe(
      "school of magic",
    );
    expect(labelForTag(tag("{@filter fey|bestiary|type=fey}"))).toBe("fey");
  });

  it("shows the per-level step for a scaling roll, not the base", () => {
    // "{@scaledamage 8d6|3-9|1d6}" is read as "1d6 per level above 3rd".
    expect(labelForTag(tag("{@scaledamage 8d6|3-9|1d6}"))).toBe("1d6");
    expect(labelForTag(tag("{@scaledice 6d10|1-9|2d10}"))).toBe("2d10");
  });

  it("signs a bare modifier so it reads as one", () => {
    expect(labelForTag(tag("{@hit 5}"))).toBe("+5");
    expect(labelForTag(tag("{@hit +6}"))).toBe("+6");
    expect(labelForTag(tag("{@d20 0}"))).toBe("+0");
  });

  it("spells out a DC and a chance", () => {
    expect(labelForTag(tag("{@dc 15}"))).toBe("DC 15");
    expect(labelForTag(tag("{@chance 5|||Message lost!|Message arrives}"))).toBe(
      "5 percent",
    );
  });

  it("reads the display text out of a quickref's fifth part", () => {
    expect(labelForTag(tag("{@quickref Cover||3||half cover}"))).toBe("half cover");
    expect(labelForTag(tag("{@quickref difficult terrain||3}"))).toBe(
      "difficult terrain",
    );
  });
});

describe("collectReferences", () => {
  it("walks strings anywhere in a nested structure", () => {
    const found = collectReferences({
      entries: [
        "A {@spell fireball} erupts.",
        { type: "entries", entries: [["Each {@creature goblin} is {@condition prone}."]] },
      ],
    });

    expect([...found]).toEqual(
      expect.arrayContaining([
        "spell|fireball|phb",
        "monster|goblin|mm",
        "condition|prone|phb",
      ]),
    );
  });

  /** "{@b {@spell fireball}}" is real markup; flattening would lose the link. */
  it("descends into tags nested inside other tags", () => {
    expect([...collectReferences("{@b {@spell fireball}}")]).toContain(
      "spell|fireball|phb",
    );
  });

  it("ignores text with no markup at all", () => {
    expect(collectReferences("A plain sentence.").size).toBe(0);
  });

  /**
   * A statblock's target is in its fields, not in tag text, so a walker that
   * only reads strings would resolve nothing and the block would not link.
   */
  it("collects the target of a statblock entry", () => {
    const found = collectReferences({
      entries: [{ type: "statblock", tag: "creature", name: "Goblin", source: "MM" }],
    });

    expect([...found]).toContain("monster|goblin|mm");
  });
});

describe("candidateKeysForStatblock", () => {
  it("addresses the same entity the equivalent tag would", () => {
    expect(
      candidateKeysForStatblock({
        tag: "spell",
        name: "Fireball",
        source: "PHB",
      }),
    ).toEqual(["spell|fireball|phb"]);
  });

  /** `{@item}` covers three types, and a statblock inherits that ambiguity. */
  it("keeps every candidate an item may be", () => {
    expect(
      candidateKeysForStatblock({ tag: "item", name: "Club", source: "PHB" }),
    ).toEqual(["item|club|phb", "baseitem|club|phb", "itemgroup|club|phb"]);
  });

  /** Fluff belongs to the entity it describes, so it points at the same key. */
  it("strips the Fluff suffix from a prop", () => {
    expect(
      candidateKeysForStatblock({
        prop: "monsterFluff",
        name: "Aboleth",
        source: "MM",
      }),
    ).toEqual(["monster|aboleth|mm"]);
  });

  it("returns nothing without a name or a kind", () => {
    expect(candidateKeysForStatblock({ tag: "creature" })).toEqual([]);
    expect(candidateKeysForStatblock({ name: "Goblin" })).toEqual([]);
  });
});

describe("parentKeyFor", () => {
  /**
   * Fragments render as anchors on a parent page, and the parent's identity is
   * already inside the fragment's own key — so finding it costs no extra lookup.
   */
  it("recovers the parent of each fragment type", () => {
    expect(parentKeyFor("subrace|hill|dwarf|phb|phb")).toBe("race|dwarf|phb");
    expect(parentKeyFor("classfeature|divine sense|paladin|phb|1|phb")).toBe(
      "class|paladin|phb",
    );
  });

  /** A PHB wizard has TCE subclasses, so the sources genuinely differ. */
  it("keeps the parent's own source rather than assuming it matches", () => {
    expect(
      parentKeyFor("subclassfeature|song of defense|wizard|phb|bladesinging|tce|6|tce"),
    ).toBe("subclass|bladesinging|wizard|phb|tce");
  });

  it("returns null for entities that have their own page", () => {
    expect(parentKeyFor("spell|fireball|phb")).toBeNull();
  });
});

describe("lookupReference", () => {
  const index = {
    "baseitem|club|phb": { name: "Club", entityType: "baseitem" as const, href: "/x" },
  };

  it("takes the first candidate that exists", () => {
    const hit = lookupReference(
      ["item|club|phb", "baseitem|club|phb", "itemgroup|club|phb"],
      index,
    );
    expect(hit?.key).toBe("baseitem|club|phb");
  });

  it("returns null when nothing resolves", () => {
    expect(lookupReference(["item|nonexistent|phb"], index)).toBeNull();
  });
});
