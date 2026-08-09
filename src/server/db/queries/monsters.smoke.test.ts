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
 * formatters against the corpus rather than against fixtures.
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
const MONSTER_COUNT = 3628;

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
     * Ingest resolves the `_copy` templates the corpus ships, so a creature
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
   * The formatters over every creature in the corpus.
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
     * A rating the experience table does not know prints as a bare number with
     * no award beside it — survivable, but it means the corpus uses a rating
     * this code has never seen.
     */
    it("awards experience for every rating in the corpus", () => {
      const unpriced = all
        .filter((row) => row.data.cr != null)
        .filter((row) => !/\(.*XP\)/.test(formatChallenge(row.data.cr)))
        .map((row) => `${row.name}: ${JSON.stringify(row.data.cr)}`);

      // The one creature the corpus itself rates "Unknown".
      expect(unpriced).toEqual(['Mechanical Bird: "Unknown"']);
    });
  });
});
