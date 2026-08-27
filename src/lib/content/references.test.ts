import { describe, expect, it } from "vitest";
import {
  areaTargetForTag,
  candidateKeysForStatblock,
  candidateKeysForTag,
  collectAreaTargets,
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
   * items, item groups and magic variants all share one tag. The variant comes
   * last so a concrete item always wins the name.
   */
  it("offers every type an item tag might address", () => {
    expect(candidateKeysForTag(tag("{@item club|phb}"))).toEqual([
      "item|club|phb",
      "baseitem|club|phb",
      "itemgroup|club|phb",
      "magicvariant|club|phb",
    ]);
  });

  /**
   * All but seven of the tables the books print live inside a chapter and have
   * no row of their own, so a table tag offers the entity key and an anchor key
   * — and the anchor key carries the caption, not the qualified name.
   */
  it("offers a table tag both a row and the chapter it is printed in", () => {
    expect(
      candidateKeysForTag(tag("{@table Cyclops; Treasure Drops|ToA}")),
    ).toEqual([
      "table|cyclops; treasure drops|toa",
      "tableanchor|treasure drops|toa",
    ]);
  });

  /** `{@table}` defaults to the DMG, which prints most of the rollable ones. */
  it("sends a sourceless table tag to the DMG", () => {
    expect(candidateKeysForTag(tag("{@table Magic Item Table C}"))).toEqual([
      "table|magic item table c|dmg",
      "tableanchor|magic item table c|dmg",
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

  /**
   * `{@race Elf (Eladrin)|DMG}` addresses `subrace|eladrin|elf|phb|dmg`. A
   * subrace key carries its parent race's source as well as its own, and a tag
   * names only one source, so the citing book cannot stand for both.
   */
  it("offers the parent race's own source for a subrace printed elsewhere", () => {
    expect(candidateKeysForTag(tag("{@race Elf (Eladrin)|DMG}"))).toEqual([
      "race|elf (eladrin)|dmg",
      "subrace|eladrin|elf|dmg|dmg",
      "subrace|eladrin|elf|phb|dmg",
    ]);
  });

  /** Every boon in the books is from Mordenkainen's, and none names a source. */
  it("resolves a boon to the only book that prints one", () => {
    expect(
      candidateKeysForTag(tag("{@boon Demonic Boon of Baphomet}")),
    ).toEqual(["boon|demonic boon of baphomet|mtf"]);
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
    ).toEqual(["booksection|phb|10", "source|phb"]);
    expect(candidateKeysForTag(tag("{@adventure appendix C|IDRotF|21}"))).toEqual([
      "booksection|idrotf|21",
      "source|idrotf",
    ]);
  });

  /**
   * Without a chapter the tag names the whole book. There is no entity for a
   * book — `entities` holds its chapters — so it addresses the source, which
   * resolves against `sources` instead of by natural key.
   */
  it("addresses the whole book when the tag names no chapter", () => {
    expect(candidateKeysForTag(tag("{@book Player's Handbook|PHB}"))).toEqual([
      "source|phb",
    ]);
    expect(candidateKeysForTag(tag("{@adventure Curse of Strahd|CoS}"))).toEqual([
      "source|cos",
    ]);
  });

  /**
   * A chapter index that names no section still leaves the book worth reaching.
   * `{@adventure appendix B|TftYP-ToH|3}` numbers its appendix against the whole
   * of Tales from the Yawning Portal, whose sections are filed under the inner
   * adventure that printed them.
   */
  it("falls back to the book when a chapter index cannot be placed", () => {
    expect(candidateKeysForTag(tag("{@adventure appendix B|TftYP-ToH|3}"))).toEqual([
      "booksection|tftyp-toh|3",
      "source|tftyp-toh",
    ]);
  });

  /** No source, nothing to address: better plain words than a wrong book. */
  it("addresses nothing when a book tag names no source", () => {
    expect(candidateKeysForTag(tag("{@book Player's Handbook}"))).toEqual([]);
  });

  /**
   * A card is addressed by its deck as well as its name. Five decks deal a
   * Jester and the key is the only thing that separates them, so a tag read as
   * `card|jester|dmg` — deck mistaken for source — matches nothing at all.
   */
  it("carries a card's deck in its key", () => {
    expect(candidateKeysForTag(tag("{@card Talons|Deck of Many Things|DMG}"))).toEqual(
      ["card|talons|deck of many things|dmg"],
    );
    expect(candidateKeysForTag(tag("{@card Jester|Deck of Many Things}"))).toEqual([
      "card|jester|deck of many things|dmg",
    ]);
    expect(
      candidateKeysForTag(tag("{@card +1 Shield|Magic Item Cards|DIP|card}")),
    ).toEqual(["card|+1 shield|magic item cards|dip"]);
  });

  it("yields nothing for tags that address no entity", () => {
    expect(candidateKeysForTag(tag("{@damage 8d6}"))).toEqual([]);
    expect(candidateKeysForTag(tag("{@filter fey|bestiary|type=fey}"))).toEqual([]);
    // A card with no deck names nothing addressable; none occur in the books.
    expect(candidateKeysForTag(tag("{@card Balance}"))).toEqual([]);
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

  /**
   * An adventure pointing at one of its own numbered locations. The second part
   * is the anchor id and the third a flag, so the default rule showed the flag:
   * 10,681 area tags across the books printed the single letter "x", and a
   * whole column of ToA's encounter tables read x, x, x.
   */
  it("names the area rather than the flag that follows it", () => {
    expect(labelForTag(tag("{@area Aarakocra|59f|x}"))).toBe("Aarakocra");
    expect(labelForTag(tag("{@area area 22a|163|u}"))).toBe("area 22a");
    // The 712 that carry no flag were right by accident, and must stay right.
    expect(labelForTag(tag("{@area 21l|217}"))).toBe("21l");
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

  /**
   * A weapon property addresses by code, and the code is the one thing that
   * must not reach the page — the Gunner feat would otherwise read "ignore the
   * LD property".
   */
  it("shows a weapon property's words rather than its code", () => {
    expect(labelForTag(tag("{@itemProperty LD|PHB|loading}"))).toBe("loading");
    expect(labelForTag(tag("{@itemProperty F|PHB|finesse}"))).toBe("finesse");
    expect(labelForTag(tag("{@itemProperty Ammunition}"))).toBe("Ammunition");
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

  /** `{@item}` covers four types, and a statblock inherits that ambiguity. */
  it("keeps every candidate an item may be", () => {
    expect(
      candidateKeysForStatblock({ tag: "item", name: "Club", source: "PHB" }),
    ).toEqual([
      "item|club|phb",
      "baseitem|club|phb",
      "itemgroup|club|phb",
      "magicvariant|club|phb",
    ]);
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

/**
 * The cookbooks' agreement tag. The count reaches it already substituted from
 * an amount placeholder, which is why it can be a numeral, a spelled-out word
 * or a fraction — see `ingredientText`.
 */
describe("labelForTag on a unit", () => {
  it("agrees with the count", () => {
    expect(labelForTag(tag("{@unit 1|egg|eggs}"))).toBe("egg");
    expect(labelForTag(tag("{@unit 2|yolk|yolks}"))).toBe("yolks");
  });

  it("treats a fraction and a spelled-out one as singular", () => {
    expect(labelForTag(tag("{@unit ½|cup|cups}"))).toBe("cup");
    expect(labelForTag(tag("{@unit One|bottle|bottles}"))).toBe("bottle");
  });

  /** 1½ cups, not 1½ cup. */
  it("treats a mixed number as more than one", () => {
    expect(labelForTag(tag("{@unit 1½|cup|cups}"))).toBe("cups");
  });
});

/**
 * `{@area}` addresses a position inside a chapter — the `id` the source data
 * hangs on the entry node — rather than an entity by natural key. It is the
 * only tag that does, which is why it has a kind of its own.
 */
describe("area anchors", () => {
  it("is a kind apart from a reference", () => {
    expect(kindOfTag("area")).toBe("anchor");
  });

  it("reads the entry id out of the second part", () => {
    expect(areaTargetForTag(tag("{@area Aarakocra|59f|x}"))).toBe("59f");
    expect(areaTargetForTag(tag("{@area 21l|217}"))).toBe("217");
  });

  it("has no target when the tag names none", () => {
    expect(areaTargetForTag(tag("{@area see below}"))).toBeNull();
    expect(areaTargetForTag(tag("{@spell fireball}"))).toBeNull();
  });

  it("collects every target on a page in one pass", () => {
    const found = collectAreaTargets({
      entries: [
        "Head for {@area the bridge|1a2|x}.",
        { type: "table", rows: [["{@area Aarakocra|59f|x}", "01–05"]] },
      ],
    });

    expect([...found].sort()).toEqual(["1a2", "59f"]);
  });
});
