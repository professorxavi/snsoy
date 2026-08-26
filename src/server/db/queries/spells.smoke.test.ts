import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  componentLetters,
  formatCastingTime,
  formatClassList,
  formatRange,
  levelShort,
  schoolName,
  spellSubtitle,
} from "@/lib/content/spells";
import type * as SpellQueries from "./spells";

/**
 * Smoke test: run the spell queries against the seeded database.
 *
 * The facet query is the reason this file exists. It groups over every spell to
 * get the full option domain, but counts each option with a FILTER built from
 * the *other* filters — so options never appear or disappear as you filter,
 * they only become unavailable. Get that wrong and nothing throws: you get
 * plausible numbers that are quietly incorrect, and a rail that rearranges
 * itself under the cursor.
 *
 * Counts are exact on purpose. Ingest runs once and every instance is built by
 * restoring the same dump, so a number that moves means either the seed was
 * re-cut or a query started including rows it should not.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const TOTAL = 525;
const PER_PAGE = 50;
const PAGE_COUNT = 11;

describeDb("spell queries against the seed", () => {
  let queries: typeof SpellQueries;

  // Imported late: the module reaches the env schema through the db client,
  // which throws at import time when DATABASE_URL is missing.
  beforeAll(async () => {
    queries = await import("./spells");
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("listSpells", () => {
    it("pages every spell", async () => {
      const list = await queries.listSpells();

      expect(list.total).toBe(TOTAL);
      expect(list.perPage).toBe(PER_PAGE);
      expect(list.pageCount).toBe(PAGE_COUNT);
      expect(list.rows).toHaveLength(PER_PAGE);
    });

    it("leaves a partial last page rather than padding it", async () => {
      const last = await queries.listSpells({ page: PAGE_COUNT });

      expect(last.rows).toHaveLength(TOTAL - PER_PAGE * (PAGE_COUNT - 1));
    });

    it("moves the window between pages", async () => {
      const [one, two] = await Promise.all([
        queries.listSpells({ page: 1 }),
        queries.listSpells({ page: 2 }),
      ]);

      expect(one.rows[0]!.name).not.toBe(two.rows[0]!.name);
      const overlap = new Set(one.rows.map((r) => r.id));
      expect(two.rows.some((r) => overlap.has(r.id))).toBe(false);
    });

    /**
     * Clamping has to happen before the offset is taken, not after the rows
     * come back — otherwise `?page=999` reports "page 11 of 11" above an empty
     * table.
     */
    it("clamps a page past the end onto the last one, with rows", async () => {
      const beyond = await queries.listSpells({ page: 999 });

      expect(beyond.page).toBe(PAGE_COUNT);
      expect(beyond.rows.length).toBeGreaterThan(0);
    });

    it("clamps a page below the first", async () => {
      expect((await queries.listSpells({ page: 0 })).page).toBe(1);
      expect((await queries.listSpells({ page: -5 })).page).toBe(1);
    });

    describe("sorting", () => {
      /**
       * Compared with `<=` rather than `localeCompare`. Postgres sorts this
       * column by code unit — "Blade Ward" lands before "Blade of Disaster",
       * because `W` precedes `o` — and a test written against JavaScript's
       * locale collation would be asserting the wrong rule, then failing on a
       * pair of real spell names that are ordered perfectly correctly.
       */
      it("orders by name by default, across every page", async () => {
        const names = (await queries.listSpells({ perPage: TOTAL })).rows.map(
          (row) => row.name,
        );

        expect(names).toHaveLength(TOTAL);
        expect(names.every((name, i) => i === 0 || names[i - 1]! <= name)).toBe(
          true,
        );
      });

      it("puts cantrips first when sorting by level", async () => {
        const list = await queries.listSpells({ sort: "level" });

        expect(list.rows[0]!.level).toBe(0);
      });

      /** Level ties break by name, or paging through a level is unstable. */
      it("breaks level ties by name", async () => {
        const cantrips = (await queries.listSpells({ sort: "level" })).rows
          .filter((row) => row.level === 0)
          .map((row) => row.name);

        expect(
          cantrips.every((name, i) => i === 0 || cantrips[i - 1]! <= name),
        ).toBe(true);
      });
    });

    describe("search", () => {
      it("matches on name, case-insensitively", async () => {
        const fire = await queries.listSpells({ q: "fire" });

        expect(fire.total).toBeGreaterThan(0);
        expect(fire.rows.every((row) => /fire/i.test(row.name))).toBe(true);
      });

      it("returns nothing rather than everything for no match", async () => {
        const none = await queries.listSpells({ q: "zzzzzzzz" });

        expect(none.total).toBe(0);
        expect(none.rows).toEqual([]);
        // Still one page, so the pager stays away instead of reading "of 0".
        expect(none.pageCount).toBe(1);
      });
    });

    it("narrows on a filter", async () => {
      const cantrips = await queries.listSpells({ levels: [0] });

      expect(cantrips.total).toBe(46);
      expect(cantrips.rows.every((row) => row.level === 0)).toBe(true);
    });

    /**
     * The route-map invariant, checked against real data: `/compendium/spells/
     * [source]/[slug]` has to address exactly one spell. Slugs collide across
     * sources, so it is the pair that must be unique.
     */
    it("gives every spell a URL of its own", async () => {
      const all = await queries.listSpells({ perPage: TOTAL });
      const urls = new Set(
        all.rows.map((row) => `${row.sourceId.toLowerCase()}/${row.slug}`),
      );

      expect(urls.size).toBe(TOTAL);
    });
  });

  describe("spellFacets", () => {
    it("offers every level, school, casting time and class in the books", async () => {
      const facets = await queries.spellFacets();

      expect(facets.levels.map((o) => o.value)).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);
      expect(facets.schools.map((o) => o.value)).toEqual([
        "A", "C", "D", "E", "I", "N", "T", "V",
      ]);
      expect(facets.classes.map((o) => o.value)).toEqual([
        "Artificer", "Bard", "Cleric", "Druid", "Monk",
        "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard",
      ]);
    });

    /** Action economy order, not alphabetical — which would put hour second. */
    it("orders casting times by action economy", async () => {
      const times = (await queries.spellFacets()).castingTimes.map(
        (o) => o.value,
      );

      expect(times).toEqual(["action", "bonus", "reaction", "minute", "hour"]);
    });

    it("counts each option against an unfiltered list", async () => {
      const facets = await queries.spellFacets();
      const sum = (options: { count: number }[]) =>
        options.reduce((n, o) => n + o.count, 0);

      // Every spell has exactly one level and one school, so both partition it.
      expect(sum(facets.levels)).toBe(TOTAL);
      expect(sum(facets.schools)).toBe(TOTAL);
      expect(facets.concentration.count).toBe(234);
      expect(facets.ritual.count).toBe(34);
    });

    /**
     * The rail must not rearrange as filters are applied, so the domain is
     * fixed and only the counts move.
     */
    it("keeps the full domain when a filter is applied", async () => {
      const [all, ninth] = await Promise.all([
        queries.spellFacets(),
        queries.spellFacets({ levels: [9] }),
      ]);

      expect(ninth.levels).toHaveLength(all.levels.length);
      expect(ninth.schools).toHaveLength(all.schools.length);
      expect(ninth.classes).toHaveLength(all.classes.length);
    });

    it("recounts the other facets against the applied filter", async () => {
      const ninth = await queries.spellFacets({ levels: [9] });
      const list = await queries.listSpells({ levels: [9] });
      const sum = ninth.schools.reduce((n, o) => n + o.count, 0);

      expect(sum).toBe(list.total);
      expect(sum).toBeLessThan(TOTAL);
    });

    /** A facet is counted against the other filters, never against itself. */
    it("does not let a level filter zero out the other levels", async () => {
      const ninth = await queries.spellFacets({ levels: [9] });

      expect(ninth.levels.every((o) => o.count > 0)).toBe(true);
      expect(ninth.levels.find((o) => o.value === 9)!.selected).toBe(true);
    });

    it("marks an option with nothing behind it unavailable", async () => {
      const ninth = await queries.spellFacets({ levels: [9] });
      const unavailable = ninth.classes.filter((o) => o.disabled);

      expect(unavailable.length).toBeGreaterThan(0);
      expect(unavailable.every((o) => o.count === 0)).toBe(true);
    });

    /**
     * The rule that keeps the rail escapable: a selected option stays
     * clickable even at zero, because clicking it is the only way to undo a
     * filter that narrowed to nothing. Asserted as an invariant across several
     * combinations rather than one magic pair, so re-cutting the seed cannot
     * quietly stop exercising it.
     */
    it("never disables a selected option", async () => {
      const combinations = [
        {},
        { levels: [9] },
        { levels: [9], classes: ["Monk"] },
        { levels: [0], schools: ["A"], classes: ["Wizard"] },
        { classes: ["Artificer"], ritual: true },
        { q: "zzzzzzzz", levels: [1, 2] },
      ];

      for (const filters of combinations) {
        const facets = await queries.spellFacets(filters);
        const options = [
          ...facets.levels,
          ...facets.schools,
          ...facets.castingTimes,
          ...facets.classes,
          facets.concentration,
          facets.ritual,
        ];

        expect(
          options.filter((o) => o.selected && o.disabled),
          `selected option disabled for ${JSON.stringify(filters)}`,
        ).toEqual([]);
        expect(options.every((o) => !o.disabled || o.count === 0)).toBe(true);
      }
    });
  });

  /**
   * Every formatter over every spell.
   *
   * The unit tests in `lib/content/spells.test.ts` cover the shapes someone
   * thought to write down. This covers the shapes the books actually holds,
   * which is where the surprises are — a range with no distance, a duration
   * that is only `special`, a spell granted to no class at all. A formatter
   * that returns an empty string leaves a blank cell in the table, and a blank
   * cell reads as missing data rather than as "not applicable".
   */
  describe("formatters over every spell", () => {
    const FORMATTERS = [
      ["schoolName", (r: SpellQueries.SpellRow) => schoolName(r.school)],
      ["levelShort", (r: SpellQueries.SpellRow) => levelShort(r.level)],
      [
        "spellSubtitle",
        (r: SpellQueries.SpellRow) => spellSubtitle(r.level, r.school),
      ],
      [
        "formatCastingTime",
        (r: SpellQueries.SpellRow) => formatCastingTime(r.time ?? undefined),
      ],
      ["formatRange", (r: SpellQueries.SpellRow) => formatRange(r.range)],
      [
        "componentLetters",
        (r: SpellQueries.SpellRow) => componentLetters(r.components),
      ],
      [
        "formatClassList",
        (r: SpellQueries.SpellRow) => formatClassList(r.classes),
      ],
    ] as const;

    it.each(FORMATTERS)(
      "%s returns something printable for all 525 spells",
      async (name, format) => {
        const rows = (await queries.listSpells({ perPage: TOTAL })).rows;
        const empty: string[] = [];

        for (const row of rows) {
          const output = format(row);
          expect(typeof output, `${name} on ${row.name}`).toBe("string");
          if (output.trim() === "") empty.push(row.name);
        }

        expect(empty, `${name} produced a blank cell`).toEqual([]);
      },
    );
  });
});
