import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as SearchQueries from "./search";

/**
 * Smoke test: run search against the seeded database.
 *
 * This is the tier the feature has to be checked at. Ranking is a claim about
 * 12,851 real rows and cannot be asserted against a fixture — a handful of
 * invented entities would rank correctly under almost any formula, including
 * the `ts_rank` one that put Fireball seventh. The cases below are the measured
 * failures that drove the design, so a regression in the scoring reproduces one
 * of them by name.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

/** Where in the results a row for `name` of `type` sits, or -1. */
function positionOf(
  rows: { name: string; entityType: string }[],
  name: string,
  type: string,
): number {
  return rows.findIndex((row) => row.name === name && row.entityType === type);
}

describeDb("search against the seed", () => {
  let queries: typeof SearchQueries;

  beforeAll(async () => {
    queries = await import("./search");
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("the cases that broke ts_rank", () => {
    /**
     * The original failure. Under `ts_rank` alone this arrived seventh, behind
     * a 59,000-character Waterdeep chapter named after a tavern, two magic
     * items, a recipe card and a spell that merely starts with the same word.
     */
    it("puts the Fireball spell first for 'fireball'", async () => {
      const { rows } = await queries.searchEntities({ q: "fireball" });

      expect(rows[0]!.name).toBe("Fireball");
      expect(rows[0]!.entityType).toBe("spell");
      expect(rows[0]!.sourceId).toBe("PHB");
    });

    /**
     * The chapter is a real entity that is genuinely named Fireball, so it must
     * still be found — just not ahead of the spell.
     */
    it("keeps the Waterdeep chapter, below the spell", async () => {
      const { rows } = await queries.searchEntities({ q: "fireball" });
      const chapter = positionOf(rows, "Fireball", "bookSection");

      expect(chapter).toBeGreaterThan(0);
    });

    /**
     * A longer name containing the query must never outrank the exact match,
     * however good its body score. This is what the tier ordering buys.
     */
    it("ranks an exact name above every name that merely contains it", async () => {
      const { rows } = await queries.searchEntities({ q: "fireball" });

      expect(positionOf(rows, "Fireball", "spell")).toBeLessThan(
        positionOf(rows, "Necklace of Fireballs", "item"),
      );
      expect(positionOf(rows, "Fireball", "spell")).toBeLessThan(
        positionOf(rows, "Delayed Blast Fireball", "spell"),
      );
    });

    /**
     * Boxed sets reprint conditions on cardboard: "Grappled" is one condition
     * and two identical cards. Prominence is what separates them, and it can
     * only act inside a tier — all three are exact name matches.
     */
    it("prefers the condition over the cards that reprint it", async () => {
      const { rows } = await queries.searchEntities({ q: "grappled" });

      expect(rows[0]!.entityType).toBe("condition");
      expect(rows[0]!.sourceId).toBe("PHB");
    });
  });

  describe("recall", () => {
    /** Stemming: the corpus writes "Fireballs" and the query says "fireball". */
    it("reaches plural names through the stemmer", async () => {
      const { rows } = await queries.searchEntities({ q: "fireball" });

      expect(positionOf(rows, "Wand of Fireballs", "item")).toBeGreaterThan(-1);
    });

    /**
     * Trigram similarity, which is the only signal that survives a misspelling:
     * "missle" matches no lexeme in the corpus at all.
     */
    it("finds a misspelled name", async () => {
      const { rows } = await queries.searchEntities({ q: "magic missle" });

      expect(rows[0]!.name).toBe("Magic Missile");
      expect(rows[0]!.entityType).toBe("spell");
    });

    /**
     * Body text, which is the only way to answer a question about a rule whose
     * name nobody remembers exactly. The action is named for it, so it wins on
     * tier — but it is reachable only because the body is indexed.
     */
    it("answers a rules phrase from prose", async () => {
      const { rows } = await queries.searchEntities({ q: "opportunity attack" });

      expect(rows[0]!.name).toBe("Opportunity Attack");
      expect(rows.length).toBeGreaterThan(1);
    });

    it("returns nothing for a query that matches nothing", async () => {
      const { rows, total } = await queries.searchEntities({ q: "xyzzyplugh" });

      expect(rows).toEqual([]);
      expect(total).toBe(0);
    });
  });

  describe("addressing a result", () => {
    /**
     * A fragment has no page of its own and its name means nothing alone —
     * Sneak Attack is a `classFeature` called "Sneak Attack" whose parent is
     * the Rogue. Both the parent's name and an anchored URL into its page have
     * to come back, or the top result for a very ordinary query is an
     * unclickable word.
     */
    it("gives a class feature its parent and an anchored URL", async () => {
      const { rows } = await queries.searchEntities({ q: "sneak attack" });
      const feature = rows[0]!;

      expect(feature.name).toBe("Sneak Attack");
      expect(feature.entityType).toBe("classFeature");
      expect(feature.parentName).toBe("Rogue");
      expect(feature.href).toBe("/compendium/classes/phb/rogue#sneak-attack");
    });

    /** A whole entity carries no parent and addresses its own page. */
    it("gives a spell its canonical URL and no parent", async () => {
      const { rows } = await queries.searchEntities({ q: "fireball" });

      expect(rows[0]!.href).toBe("/compendium/spells/phb/fireball");
      expect(rows[0]!.parentName).toBeNull();
    });

    /** Chapters address the reader, not the compendium. */
    it("addresses a chapter through its source", async () => {
      const { rows } = await queries.searchEntities({ q: "fireball" });
      const chapter = rows.find((row) => row.entityType === "bookSection")!;

      expect(chapter.href).toMatch(/^\/sources\/wdh\//);
    });
  });

  describe("snippets", () => {
    /**
     * A row whose name says nothing about the query has to justify itself, and
     * the prose is the only thing that can.
     */
    it("returns a delimited passage for a body-only match", async () => {
      const { rows } = await queries.searchEntities({
        q: "opportunity attack",
        perPage: 50,
      });
      const { parseSnippet } = await import("@/lib/content/search");

      const bodyOnly = rows.filter((row) => row.tier === 0);
      expect(bodyOnly.length).toBeGreaterThan(0);

      const parts = parseSnippet(bodyOnly[0]!.snippet);
      const matched = parts.filter((part) => part.match);

      expect(parts.length).toBeGreaterThan(0);
      expect(matched.length).toBeGreaterThan(0);
      expect(matched.map((part) => part.text.toLowerCase())).toContain("attack");
    });

    /**
     * The indexed body opens with a metadata preamble — the name, then every
     * source that reprints it, then loose enum values. A query that matched the
     * name matches that preamble densely, so a headline for one of these rows
     * came back "Wand of Fireballs DMG CoA OoW SKT WDMM WD|DMG major rare".
     */
    it("gives no snippet to a row whose name already matched", async () => {
      const { rows } = await queries.searchEntities({
        q: "fireball",
        perPage: 50,
      });
      const named = rows.filter((row) => row.tier > 0);

      expect(named.length).toBeGreaterThan(0);
      expect(named.every((row) => row.snippet === null)).toBe(true);
    });

    /**
     * A row reached by trigram alone has no matching lexeme anywhere in it, and
     * `ts_headline` answers a query it cannot find with the head of the
     * document — the preamble again, this time with nothing highlighted.
     */
    it("gives no snippet to a row the body never matched", async () => {
      const { rows } = await queries.searchEntities({
        q: "magic missle",
        perPage: 50,
      });

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.snippet === null)).toBe(true);
    });

    /** The delimiters must never be printable, or prose could forge them. */
    it("never emits markup", async () => {
      const { rows } = await queries.searchEntities({
        q: "opportunity attack",
        perPage: 50,
      });

      for (const row of rows) {
        expect(row.snippet ?? "").not.toContain("<");
      }
    });
  });

  describe("paging and filtering", () => {
    it("reports a total larger than the page and pages stably", async () => {
      const first = await queries.searchEntities({ q: "fire", perPage: 5 });
      const second = await queries.searchEntities({
        q: "fire",
        perPage: 5,
        page: 2,
      });

      expect(first.total).toBeGreaterThan(5);
      expect(first.rows).toHaveLength(5);
      expect(second.rows).toHaveLength(5);

      const ids = new Set(first.rows.map((row) => row.id));
      expect(second.rows.some((row) => ids.has(row.id))).toBe(false);
    });

    /** Past the end returns nothing rather than the last page again. */
    it("clamps the reported page to the last one", async () => {
      const page = await queries.searchEntities({
        q: "fireball",
        perPage: 5,
        page: 99,
      });

      expect(page.rows).toEqual([]);
      expect(page.page).toBe(page.pageCount);
    });

    it("narrows to the chosen types", async () => {
      const { rows, total } = await queries.searchEntities({
        q: "fire",
        types: ["spell"],
      });

      expect(total).toBeGreaterThan(0);
      expect(rows.every((row) => row.entityType === "spell")).toBe(true);
    });
  });

  describe("suggestEntities", () => {
    it("puts the entity everyone means first, and caps the list", async () => {
      const rows = await queries.suggestEntities("fireball");

      expect(rows[0]!.name).toBe("Fireball");
      expect(rows[0]!.entityType).toBe("spell");
      expect(rows.length).toBeLessThanOrEqual(queries.SUGGESTION_LIMIT);
    });

    /**
     * The clause that separates typeahead from the results page. Every one of
     * these rows has to be explicable from its name alone, because a dropdown
     * row has no space for the snippet that would justify a prose match.
     */
    it("returns only rows whose name relates to the query", async () => {
      const suggestions = await queries.suggestEntities("fireball");
      const names = suggestions.map((row) => row.name.toLowerCase());

      expect(names.length).toBeGreaterThan(0);
      expect(names.every((name) => name.includes("fireball"))).toBe(true);
    });

    /**
     * "Opportunity Attack" is an action *named* for the phrase, so it belongs
     * in the dropdown. The creatures and rules whose stat blocks merely mention
     * it do not — on the results page they are most of the first page, and each
     * carries a snippet saying why. Here they would be bare names with no
     * visible connection to what was typed.
     */
    it("drops the body-only matches the results page keeps", async () => {
      const suggested = await queries.suggestEntities("opportunity attack");
      const searched = await queries.searchEntities({
        q: "opportunity attack",
        perPage: 20,
      });

      expect(suggested[0]!.name).toBe("Opportunity Attack");

      // The results page earns its extra rows from prose; every one of them
      // carries the snippet that explains it.
      const bodyOnly = searched.rows.filter((row) => row.tier === 0);
      expect(bodyOnly.length).toBeGreaterThan(0);
      expect(bodyOnly.every((row) => row.snippet !== null)).toBe(true);

      // None of them reach the dropdown.
      const suggestedIds = new Set(suggested.map((row) => row.id));
      expect(bodyOnly.some((row) => suggestedIds.has(row.id))).toBe(false);
    });

    /**
     * The case typeahead is most useful for: you cannot spell it, which is why
     * you are typing slowly. This row has tier 0 and no matching lexeme at all,
     * so it survives only because trigram similarity is part of the filter.
     */
    it("still suggests through a misspelling", async () => {
      const rows = await queries.suggestEntities("magic missle");

      expect(rows[0]!.name).toBe("Magic Missile");
    });

    /** A fragment needs its parent, or the row is a bare word. */
    it("qualifies and addresses a fragment", async () => {
      const rows = await queries.suggestEntities("sneak attack");

      expect(rows[0]!.name).toBe("Sneak Attack");
      expect(rows[0]!.parentName).toBe("Rogue");
      expect(rows[0]!.href).toBe("/compendium/classes/phb/rogue#sneak-attack");
    });

    it("is empty for a query that matches nothing", async () => {
      expect(await queries.suggestEntities("xyzzyplugh")).toEqual([]);
    });
  });

  describe("searchFacets", () => {
    it("counts every type the query reaches", async () => {
      const facets = await queries.searchFacets("fireball");
      const types = facets.types.map((facet) => facet.value);

      expect(types).toContain("spell");
      expect(types).toContain("item");
      expect(facets.types.every((facet) => facet.count > 0)).toBe(true);
    });

    it("orders by count, commonest first", async () => {
      const facets = await queries.searchFacets("fire");
      const counts = facets.types.map((facet) => facet.count);

      expect(counts).toEqual([...counts].sort((a, b) => b - a));
    });

    /**
     * Counted against the whole candidate set rather than against itself. The
     * type facet is the only filter there is, so counting it against its own
     * selection would zero every option the moment one was chosen.
     */
    it("keeps every option counted while one is selected", async () => {
      const facets = await queries.searchFacets("fireball", {
        types: ["spell"],
      });
      const item = facets.types.find((facet) => facet.value === "item")!;

      expect(item.count).toBeGreaterThan(0);
      expect(item.disabled).toBe(false);
      expect(facets.types.find((facet) => facet.value === "spell")!.selected).toBe(
        true,
      );
    });
  });

  describe("the query string is data, not syntax", () => {
    /**
     * `%` and `_` are characters someone typed, never wildcards.
     *
     * Asserted on the tier rather than on the total: full-text recall is
     * unaffected either way, since the tokenizer drops the punctuation and
     * "fire%" still finds everything "fire" finds. What must not happen is a
     * *name* match — no entity is called "fire%", so an unescaped `%` would
     * show up as Fire Bolt arriving at tier 2.
     */
    it("does not read LIKE wildcards from the query", async () => {
      const wild = await queries.searchEntities({ q: "fire%", perPage: 50 });
      const literal = await queries.searchEntities({ q: "fire", perPage: 50 });

      expect(wild.total).toBeGreaterThan(0);
      expect(wild.rows.every((row) => row.tier === 0)).toBe(true);
      expect(literal.rows[0]!.tier).toBe(3);
    });

    it("survives punctuation websearch_to_tsquery treats as operators", async () => {
      await expect(
        queries.searchEntities({ q: '"unclosed quote or -' }),
      ).resolves.toBeDefined();
    });

    /**
     * A trailing backslash is the one character that can make `LIKE` raise
     * rather than simply not match — "pattern must not end with escape
     * character" — so it has to survive being doubled before the wildcards are
     * escaped, not after.
     */
    it("survives a trailing backslash", async () => {
      await expect(
        queries.searchEntities({ q: "fire\\" }),
      ).resolves.toBeDefined();
    });
  });
});
