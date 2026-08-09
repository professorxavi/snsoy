import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conditionEffect } from "@/lib/content/conditions";
import type * as ConditionQueries from "./conditions";

/**
 * Smoke test: run the condition queries against the seeded database.
 *
 * The same two things the skill queries needed checking for. A condition is a
 * `generic_entities` row sharing one table with a dozen other types — including
 * the two statuses from the same book — so the entity-type predicate is the
 * only thing scoping a lookup; and the effect lines the list prints are keyed
 * by slug in a hand-written map, which the seed can silently outgrow.
 *
 * Counts are exact. Ingest runs once and every instance restores the same dump,
 * so a number that moves means the seed was re-cut or a query changed shape.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

/** The fifteen of the Player's Handbook, and no other book adds one. */
const CONDITION_COUNT = 15;

describeDb("condition queries against the seed", () => {
  let queries: typeof ConditionQueries;

  beforeAll(async () => {
    queries = await import("./conditions");
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("listConditions", () => {
    it("returns every condition, in name order", async () => {
      const rows = await queries.listConditions();
      const names = rows.map((row) => row.name);

      expect(rows).toHaveLength(CONDITION_COUNT);
      expect(names[0]).toBe("Blinded");
      expect(names.at(-1)).toBe("Unconscious");
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    /** Statuses are a type of their own and get their own view, not this one. */
    it("does not sweep the statuses in with them", async () => {
      const names = (await queries.listConditions()).map((row) => row.name);

      expect(names).not.toContain("Concentration");
      expect(names).not.toContain("Surprised");
    });

    /**
     * The list prints an effect line per row from a map keyed by slug. A
     * condition the map does not know renders an empty cell, which looks like a
     * styling bug rather than missing copy.
     */
    it("has an effect line for every condition in the seed", async () => {
      const rows = await queries.listConditions();
      const unsummarised = rows
        .filter((row) => conditionEffect(row.slug) === null)
        .map((row) => row.slug);

      expect(unsummarised).toEqual([]);
    });

    /** The aside is keyed on source and slug, so the pair has to be unique. */
    it("identifies every condition uniquely", async () => {
      const rows = await queries.listConditions();
      const keys = new Set(
        rows.map((row) => `${row.sourceId.toLowerCase()}/${row.slug}`),
      );

      expect(keys.size).toBe(rows.length);
    });
  });

  describe("getCondition", () => {
    it("returns a condition with the effects the aside prints", async () => {
      const grappled = await queries.getCondition("PHB", "grappled");

      expect(grappled).not.toBeNull();
      expect(grappled!.name).toBe("Grappled");
      expect(grappled!.sourceName).toBe("Player's Handbook");
      expect(
        (grappled!.data as { entries?: unknown[] }).entries?.length,
      ).toBeGreaterThan(0);
    });

    /** Source ids are mixed case in the data but lowercase in a URL. */
    it("matches the source case-insensitively", async () => {
      expect((await queries.getCondition("phb", "prone"))?.name).toBe("Prone");
    });

    it("is null for a condition that does not exist", async () => {
      expect(await queries.getCondition("phb", "no-such-condition")).toBeNull();
    });

    /**
     * Concentration is a PHB status sitting in the same table. Without the
     * entity-type predicate it would answer to a condition lookup and open in
     * the aside as one.
     */
    it("does not reach a generic entity of another type", async () => {
      expect(await queries.getCondition("phb", "concentration")).toBeNull();
    });
  });
});
