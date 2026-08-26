import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  formatArmorClass,
  formatChallenge,
  formatCreatureLine,
  formatHitPoints,
  formatSpeed,
} from "@/lib/content/monsters";
import type * as MonsterQueries from "./monsters";

/**
 * Smoke test: run the monster query against the seeded database, and check the
 * formatters against the books rather than against fixtures.
 *
 * `monsters.test.ts` proves each shape formats correctly, but it proves it
 * against shapes written by hand. This is the tier that catches the shape
 * nobody wrote down: a creature whose armour class is a form the formatter
 * silently drops, or whose challenge rating produces an empty string. Sweeping
 * all 3,628 is what makes that a test rather than a hope.
 *
 * Counts are exact. Ingest runs once and every instance restores the same dump,
 * so a number that moves means the seed was re-cut or a query changed shape.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

/** Creatures in the published-material seed. */
const MONSTER_COUNT = 3619;

/** Of those, the ones with no illustration at all — every one has a token. */
const ARTLESS_COUNT = 1125;

describeDb("monster queries against the seed", () => {
  let queries: typeof MonsterQueries;
  let db: typeof import("../client").db;
  let sql: typeof import("drizzle-orm").sql;

  beforeAll(async () => {
    queries = await import("./monsters");
    db = (await import("../client")).db;
    sql = (await import("drizzle-orm")).sql;
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("listMonsters", () => {
    it("pages, and reports the full count as the total", async () => {
      const list = await queries.listMonsters();

      expect(list.total).toBe(MONSTER_COUNT);
      expect(list.rows).toHaveLength(50);
      expect(list.page).toBe(1);
      expect(list.pageCount).toBe(Math.ceil(MONSTER_COUNT / 50));
    });

    it("orders by name by default", async () => {
      const names = (await queries.listMonsters()).rows.map((row) => row.name);

      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    /**
     * A page beyond the end is clamped to the last one. Reporting the requested
     * page instead gives "page 999 of 73" over an empty table.
     */
    it("clamps a page past the end", async () => {
      const list = await queries.listMonsters({ page: 9999 });

      expect(list.page).toBe(list.pageCount);
      expect(list.rows.length).toBeGreaterThan(0);
    });

    /**
     * CR is stored as a number so it sorts, and 84 creatures have none. Sorted
     * ascending they belong at the end — a list of unrated creatures is not
     * what "weakest first" means.
     */
    it("sorts by challenge with the unrated last", async () => {
      const all = await queries.listMonsters({ sort: "cr", perPage: MONSTER_COUNT });
      const ratings = all.rows.map((row) => row.cr);

      const rated = ratings.filter((cr) => cr != null);
      expect(rated).toEqual([...rated].sort((a, b) => a! - b!));
      expect(ratings.slice(rated.length).every((cr) => cr == null)).toBe(true);
      expect(rated[0]).toBe(0);
    });

    it("filters by challenge rating as printed", async () => {
      const list = await queries.listMonsters({ crs: ["1/4"] });

      expect(list.total).toBe(215);
      expect(list.rows.every((row) => row.crDisplay === "1/4")).toBe(true);
    });

    /** A creature that is Small or Medium has to answer to both. */
    it("matches either size a creature spans", async () => {
      const small = await queries.listMonsters({ sizes: ["S"], perPage: MONSTER_COUNT });
      const spanning = small.rows.filter((row) => (row.sizes?.length ?? 0) > 1);

      expect(spanning.length).toBeGreaterThan(0);
      expect(spanning.every((row) => row.sizes?.includes("S"))).toBe(true);
    });

    it("narrows on several facets at once", async () => {
      const list = await queries.listMonsters({
        types: ["dragon"],
        legendary: true,
      });

      expect(list.total).toBeGreaterThan(0);
      expect(
        list.rows.every((row) => row.creatureType === "dragon" && row.isLegendary),
      ).toBe(true);
    });

    it("searches names case-insensitively", async () => {
      const list = await queries.listMonsters({ q: "GOBLIN" });

      expect(list.total).toBeGreaterThan(0);
      expect(list.rows.every((row) => /goblin/i.test(row.name))).toBe(true);
    });

    it("returns an empty page rather than failing on no matches", async () => {
      const list = await queries.listMonsters({ q: "no-such-creature-anywhere" });

      expect(list.total).toBe(0);
      expect(list.rows).toEqual([]);
      expect(list.pageCount).toBe(1);
    });
  });

  describe("monsterFacets", () => {
    it("offers every value in the books", async () => {
      const facets = await queries.monsterFacets();

      // 33 numeric ratings, plus "Unknown" — the one creature the books
      // itself declines to rate.
      expect(facets.crs).toHaveLength(34);
      expect(facets.types).toHaveLength(14);
      expect(facets.sizes).toHaveLength(6);
      expect(facets.environments).toHaveLength(11);
    });

    /**
     * "10" must not sort before "2", and "1/2" belongs between "1/4" and "1".
     * Ordering by the printed string does all three wrong, which is why the
     * facet carries the numeric rating alongside it.
     */
    it("orders challenge ratings numerically, not as text", async () => {
      const facets = await queries.monsterFacets();
      const values = facets.crs.map((facet) => facet.value);

      expect(values.slice(0, 6)).toEqual(["0", "1/8", "1/4", "1/2", "1", "2"]);
      expect(values.at(-2)).toBe("30");
    });

    /**
     * "Unknown" has no numeric rating behind it, so it has no place on the
     * scale. Read as a zero — which is what `Number(null)` gives — it sorts
     * ahead of CR 0 and heads the entire rail.
     */
    it("puts the unrateable at the end rather than the front", async () => {
      const values = (await queries.monsterFacets()).crs.map((f) => f.value);

      expect(values[0]).toBe("0");
      expect(values.at(-1)).toBe("Unknown");
    });

    it("orders sizes from smallest to largest", async () => {
      const facets = await queries.monsterFacets();

      expect(facets.sizes.map((facet) => facet.value)).toEqual([
        "T",
        "S",
        "M",
        "L",
        "H",
        "G",
      ]);
    });

    /** Unfiltered, a facet's counts have to add up to the books. */
    it("counts every creature across the type facet", async () => {
      const facets = await queries.monsterFacets();
      const total = facets.types.reduce((sum, facet) => sum + facet.count, 0);

      // One creature has no type at all, so the facet cannot account for it.
      expect(total).toBe(MONSTER_COUNT - 1);
    });

    /**
     * The whole point of the facet query: a facet is counted against the
     * *other* filters but not its own, so selecting one type does not zero out
     * every other one and strand the reader inside their own filter.
     */
    it("counts a facet against the other filters, not its own", async () => {
      const facets = await queries.monsterFacets({ types: ["dragon"] });

      const dragon = facets.types.find((f) => f.value === "dragon")!;
      const undead = facets.types.find((f) => f.value === "undead")!;

      expect(dragon.selected).toBe(true);
      // Still offered at its full count, because the type filter is skipped
      // when counting the type facet.
      expect(undead.count).toBeGreaterThan(0);
      expect(undead.selected).toBe(false);

      // A different facet *is* narrowed by the selected type.
      const sizes = facets.sizes.reduce((sum, facet) => sum + facet.count, 0);
      expect(sizes).toBeLessThan(MONSTER_COUNT);
    });

    it("disables an option that would return nothing", async () => {
      // No creature is both a beast and a spellcaster with legendary actions.
      const facets = await queries.monsterFacets({
        types: ["beast"],
        legendary: true,
      });

      expect(facets.sizes.some((facet) => facet.disabled)).toBe(true);
      // A selected option stays clickable even at zero, or the filter that
      // narrowed to nothing could never be undone from the rail.
      expect(facets.legendary.disabled).toBe(false);
    });

    it("counts the flag facets", async () => {
      const facets = await queries.monsterFacets();

      expect(facets.legendary.count).toBe(351);
      expect(facets.spellcaster.count).toBeGreaterThan(0);
    });
  });

  describe("getMonster", () => {
    it("returns a creature with everything the stat block prints", async () => {
      const dragon = await queries.getMonster("MM", "adult-red-dragon");

      expect(dragon).not.toBeNull();
      expect(dragon!.name).toBe("Adult Red Dragon");
      expect(dragon!.sourceName).toBe("Monster Manual");
      expect(dragon!.crDisplay).toBe("17");
      expect(dragon!.isLegendary).toBe(true);

      const data = dragon!.data as Record<string, unknown>;
      expect(formatCreatureLine(data)).toBe("Huge dragon, chaotic evil");
      expect(formatArmorClass(data.ac as never)).toBe("19 (natural armor)");
      expect(formatHitPoints(data.hp as never)).toBe("256 (19d12 + 133)");
      expect(formatChallenge(data.cr as never)).toBe("17 (18,000 XP)");
    });

    /** Source ids are mixed case in the data but lowercase in a URL. */
    it("matches the source case-insensitively", async () => {
      expect((await queries.getMonster("mm", "goblin"))?.name).toBe("Goblin");
    });

    it("is null for a creature that does not exist", async () => {
      expect(await queries.getMonster("mm", "no-such-creature")).toBeNull();
    });

    /**
     * Ingest resolves the `_copy` templates the books ship, so a creature
     * defined as a variant of another arrives with the parent's statistics
     * merged in. Unresolved, its stat block would be a name and nothing else.
     */
    it("returns a copied creature with its inherited statistics", async () => {
      const exethanter = await queries.getMonster("CoS", "exethanter");
      const data = exethanter!.data as Record<string, unknown>;

      expect(formatArmorClass(data.ac as never)).toBe("17 (natural armor)");
      expect(data.action).toBeTruthy();
    });
  });

  /**
   * The formatters over every creature in the books.
   *
   * Each of these is a line printed on every stat block, so an empty result is
   * a visibly broken panel — and the shapes that produce one are exactly the
   * shapes no fixture thought to include.
   */
  describe("the formatters over the whole bestiary", () => {
    let all: { name: string; data: Record<string, never> }[];

    beforeAll(async () => {
      all = (await db.execute(
        sql`select e.name, m.data from monsters m join entities e on e.id = m.entity_id`,
      )) as unknown as typeof all;
    });

    it("has the expected number of creatures", () => {
      expect(all).toHaveLength(MONSTER_COUNT);
    });

    it("prints a size-and-type line for every creature", () => {
      const empty = all.filter((row) => !formatCreatureLine(row.data)).map((r) => r.name);

      expect(empty).toEqual([]);
    });

    it("prints an armour class and hit points for every creature that has them", () => {
      const broken = all
        .filter((row) => row.data.ac && formatArmorClass(row.data.ac) === "—")
        .map((row) => row.name);

      expect(broken).toEqual([]);
    });

    it("prints hit points for every creature that has them", () => {
      const broken = all
        .filter((row) => row.data.hp && formatHitPoints(row.data.hp) === "—")
        .map((row) => row.name);

      expect(broken).toEqual([]);
    });

    it("prints a speed for every creature that has one", () => {
      const broken = all
        .filter((row) => row.data.speed && formatSpeed(row.data.speed) === "—")
        .map((row) => row.name);

      expect(broken).toEqual([]);
    });

    /**
     * The creature page stands a map token in for the 1,125 creatures with no
     * illustration, and the path is *derived* — `bestiary/tokens/{source}/
     * {name}.webp` — rather than stored. Nothing upstream guarantees that
     * convention holds, and a path that no file backs 404s silently into an
     * empty circle on the page.
     *
     * This is the only tier that can see it: the naming rule folds accents,
     * expands ligatures and keeps spaces literal, so the creatures it would
     * break on are exactly the ones nobody writes a fixture for.
     */
    it("has a token file for every creature with no illustration", async () => {
      const { access } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { tokenPath } = await import("@/lib/content/media");

      const root = process.env.CONTENT_IMAGE_DIR;
      if (!root) return;

      /*
       * Asked of Postgres rather than filtered in memory: the shared fixture
       * carries `data` only, and widening it would make every other sweep in
       * this block pay for a column it does not read.
       */
      const artless = (await db.execute(
        sql`select e.name, e.source_id as "sourceId", m.data ->> ${"token"} as "token"
            from monsters m
            join entities e on e.id = m.entity_id
            where e.fluff -> 'images' is null
               or jsonb_array_length(e.fluff -> 'images') = 0`,
      )) as unknown as { name: string; sourceId: string; token: string | null }[];

      const missing: string[] = [];
      for (const row of artless) {
        const path = row.token ?? tokenPath("monster", row.name, row.sourceId);
        try {
          await access(join(root, path));
        } catch {
          missing.push(`${row.name} (${row.sourceId}): ${path}`);
        }
      }

      expect(artless.length).toBe(ARTLESS_COUNT);
      expect(missing).toEqual([]);
    });

    /**
     * A rating the experience table does not know prints as a bare number with
     * no award beside it — survivable, but it means the books use a rating
     * this code has never seen.
     */
    it("awards experience for every rating in the books", () => {
      const unpriced = all
        .filter((row) => row.data.cr != null)
        .filter((row) => !/\(.*XP\)/.test(formatChallenge(row.data.cr)))
        .map((row) => `${row.name}: ${JSON.stringify(row.data.cr)}`);

      // The one creature the books themselves rate "Unknown".
      expect(unpriced).toEqual(['Mechanical Bird: "Unknown"']);
    });
  });
});
