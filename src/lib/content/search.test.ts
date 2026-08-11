import { describe, expect, it } from "vitest";
import { entityTypeEnum } from "@/server/db/schema/enums";
import {
  MATCH_END,
  MATCH_START,
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  TYPE_LABELS,
  encodeOpenParam,
  normalizeQuery,
  parseOpenParam,
  parseSnippet,
  resultsHref,
  suggestionHref,
} from "./search";

describe("normalizeQuery", () => {
  it("trims and collapses whitespace, so one query is one cache entry", () => {
    expect(normalizeQuery("  fire   bolt  ")).toBe("fire bolt");
  });

  it("is null for nothing to search for", () => {
    expect(normalizeQuery(undefined)).toBeNull();
    expect(normalizeQuery("")).toBeNull();
    expect(normalizeQuery("   ")).toBeNull();
  });

  /**
   * A single character reaches nothing through the trigram index — a trigram
   * needs three — while still costing a scan of every name in the corpus.
   */
  it("refuses a query shorter than the minimum", () => {
    expect(normalizeQuery("f")).toBeNull();
    expect(normalizeQuery("fi")).toBe("fi");
    expect("fi").toHaveLength(MIN_QUERY_LENGTH);
  });

  it("truncates a pasted paragraph rather than building a huge tsquery", () => {
    const long = "fireball ".repeat(60);

    expect(normalizeQuery(long)!.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
  });

  /** Trimming happens before the length check, or "  f  " would pass it. */
  it("measures the trimmed query, not the raw one", () => {
    expect(normalizeQuery("      f      ")).toBeNull();
  });
});

describe("TYPE_LABELS", () => {
  /**
   * Every enum member is named. A missing one prints a raw value like
   * `vehicleUpgrade` in a result badge, which no reader can be expected to
   * parse.
   */
  it("names every entity type", () => {
    for (const type of entityTypeEnum.enumValues) {
      expect(TYPE_LABELS[type]).toBeTruthy();
    }
  });

  /** The player's vocabulary, not the corpus's. */
  it("calls a monster a Creature", () => {
    expect(TYPE_LABELS.monster).toBe("Creature");
    expect(TYPE_LABELS.bookSection).toBe("Chapter");
  });
});

describe("the open parameter", () => {
  it("round-trips a target", () => {
    const encoded = encodeOpenParam("monster", "MM", "goblin");

    expect(encoded).toBe("monster:mm:goblin");
    expect(parseOpenParam(encoded)).toEqual({
      type: "monster",
      sourceId: "mm",
      slug: "goblin",
    });
  });

  /** Source ids are mixed case in the data and lowercase in every URL. */
  it("lowercases the source", () => {
    expect(encodeOpenParam("monster", "TftYP-ToH", "flesh-golem")).toBe(
      "monster:tftyp-toh:flesh-golem",
    );
  });

  it("is null for nothing, and for a malformed value", () => {
    expect(parseOpenParam(undefined)).toBeNull();
    expect(parseOpenParam("")).toBeNull();
    expect(parseOpenParam("monster")).toBeNull();
    expect(parseOpenParam("monster:mm")).toBeNull();
    expect(parseOpenParam(":mm:goblin")).toBeNull();
  });

  /**
   * The value reaches `openEntityAside`, so it is validated rather than
   * trusted.
   *
   * There used to be a case here for a browsable type the aside cannot render —
   * a vehicle, then a card. Every browsable type has a renderer now, so no such
   * value exists to write down; the guard stays in `parseOpenParam` and the
   * invariant it depends on is pinned in `aside.test.ts`.
   */
  it("refuses a type that is not a type at all", () => {
    expect(parseOpenParam("../../etc:phb:passwd")).toBeNull();
    expect(parseOpenParam("constructor:phb:x")).toBeNull();
  });
});

describe("suggestionHref", () => {
  const suggestion = {
    name: "Goblin",
    entityType: "monster" as const,
    sourceId: "MM",
    slug: "goblin",
    href: "/compendium/monsters/mm/goblin",
  };

  /**
   * The case that matters most: creatures and items have no page at all, and
   * their canonical URL is a 404. Landing on the results page with the entity
   * already open is the only way to actually show one.
   */
  it("sends a renderable entity to the results page, pre-opened", () => {
    expect(suggestionHref(suggestion)).toBe(
      "/search?q=Goblin&open=monster%3Amm%3Agoblin",
    );
  });

  /**
   * The name goes in the query string and the slug in the open parameter, and
   * the two differ — ingest slugified "Melf's Acid Arrow" to "melfs-acid-arrow"
   * — so neither can be derived from the other.
   */
  it("carries the name and the slug separately, both escaped", () => {
    expect(
      suggestionHref({
        name: "Melf's Acid Arrow",
        entityType: "spell",
        sourceId: "PHB",
        slug: "melfs-acid-arrow",
        href: "/compendium/spells/phb/melfs-acid-arrow",
      }),
    ).toBe("/search?q=Melf's%20Acid%20Arrow&open=spell%3Aphb%3Amelfs-acid-arrow");
  });

  /** A chapter *is* the thing being asked for; there is nothing to preview. */
  it("sends a chapter to its own page", () => {
    expect(
      suggestionHref({
        name: "Combat",
        entityType: "bookSection",
        sourceId: "PHB",
        slug: "combat",
        href: "/sources/phb/combat",
      }),
    ).toBe("/sources/phb/combat");
  });

  /**
   * Every *browsable* type opens in the aside now, so what is left here is the
   * types with no browse route at all — psionics, and a fragment whose parent
   * could not be resolved. The results page at least shows the row, its kind
   * and its book, which is more than a 404 would.
   */
  it("falls back to the results page for a type with nowhere to go", () => {
    expect(
      suggestionHref({
        name: "Mantle of Awe",
        entityType: "psionic",
        sourceId: "UATheMysticClass",
        slug: "mantle-of-awe",
        href: null,
      }),
    ).toBe("/search?q=Mantle%20of%20Awe");
  });
});

describe("resultsHref", () => {
  it("escapes the query", () => {
    expect(resultsHref("cure wounds")).toBe("/search?q=cure%20wounds");
  });
});

describe("parseSnippet", () => {
  const mark = (text: string) => `${MATCH_START}${text}${MATCH_END}`;

  it("splits a headline into plain and matched parts", () => {
    expect(parseSnippet(`a bright ${mark("streak")} flashes`)).toEqual([
      { text: "a bright ", match: false },
      { text: "streak", match: true },
      { text: " flashes", match: false },
    ]);
  });

  it("handles a match at either end", () => {
    expect(parseSnippet(`${mark("Fireball")} PHB`)).toEqual([
      { text: "Fireball", match: true },
      { text: " PHB", match: false },
    ]);
    expect(parseSnippet(`cast ${mark("fireball")}`)).toEqual([
      { text: "cast ", match: false },
      { text: "fireball", match: true },
    ]);
  });

  it("handles several matches", () => {
    const parts = parseSnippet(`${mark("opportunity")} ${mark("attack")} rules`);

    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual([
      "opportunity",
      "attack",
    ]);
  });

  it("is empty for no snippet", () => {
    expect(parseSnippet(null)).toEqual([]);
    expect(parseSnippet(undefined)).toEqual([]);
    expect(parseSnippet("")).toEqual([]);
  });

  it("returns plain text unchanged when nothing matched", () => {
    expect(parseSnippet("no markers here")).toEqual([
      { text: "no markers here", match: false },
    ]);
  });

  /** A headline truncated mid-highlight should still print its words. */
  it("treats an unbalanced delimiter as plain text", () => {
    expect(parseSnippet(`cast ${MATCH_START}fireball`)).toEqual([
      { text: `cast ${MATCH_START}fireball`, match: false },
    ]);
  });

  /**
   * The delimiters are control characters precisely so that prose cannot forge
   * them. Nothing that arrives from the corpus is ever treated as markup.
   */
  it("does not treat angle brackets as delimiters", () => {
    expect(parseSnippet("a <b>bold</b> claim")).toEqual([
      { text: "a <b>bold</b> claim", match: false },
    ]);
  });
});
