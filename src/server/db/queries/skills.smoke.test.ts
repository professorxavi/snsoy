import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { skillCovers } from "@/lib/content/skills";
import type * as SkillQueries from "./skills";

/**
 * Smoke test: run the skill queries against the seeded database.
 *
 * Two things here can only be checked against real data. A skill is a
 * `generic_entities` row sharing one table with a dozen other types, so the
 * entity-type predicate is the only thing keeping `/skills/phb/hide` from
 * serving the Hide action; and the summary lines the list prints are keyed by
 * slug in a hand-written map, which the seed can silently outgrow.
 *
 * Counts are exact. Ingest runs once and every instance restores the same dump,
 * so a number that moves means the seed was re-cut or a query changed shape.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

/** The eighteen of the Player's Handbook, and no other book adds one. */
const SKILL_COUNT = 18;

describeDb("skill queries against the seed", () => {
  let queries: typeof SkillQueries;

  beforeAll(async () => {
    queries = await import("./skills");
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("listSkills", () => {
    it("returns every skill, in name order by default", async () => {
      const rows = await queries.listSkills();
      const names = rows.map((row) => row.name);

      expect(rows).toHaveLength(SKILL_COUNT);
      expect(names[0]).toBe("Acrobatics");
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    /**
     * Sheet order — Strength through Charisma — not alphabetical, which would
     * open on Charisma and scatter the three Intelligence skills.
     */
    it("groups by ability in the order a character sheet prints them", async () => {
      const rows = await queries.listSkills("ability");
      const abilities = [...new Set(rows.map((row) => row.ability))];

      expect(abilities).toEqual(["str", "dex", "int", "wis", "cha"]);
      expect(rows[0]!.name).toBe("Athletics");
    });

    /** Ties inside an ability break by name, or the order is not stable. */
    it("orders within an ability by name", async () => {
      const rows = await queries.listSkills("ability");
      const dex = rows.filter((row) => row.ability === "dex");

      expect(dex.map((row) => row.name)).toEqual([
        "Acrobatics",
        "Sleight of Hand",
        "Stealth",
      ]);
    });

    /**
     * The list prints a summary line per row from a map keyed by slug. A skill
     * the map does not know renders an empty cell, which looks like a styling
     * bug rather than missing copy.
     */
    it("has a summary line for every skill in the seed", async () => {
      const rows = await queries.listSkills();
      const unsummarised = rows
        .filter((row) => skillCovers(row.slug) === null)
        .map((row) => row.slug);

      expect(unsummarised).toEqual([]);
    });

    /** The aside is keyed on source and slug, so the pair has to be unique. */
    it("identifies every skill uniquely", async () => {
      const rows = await queries.listSkills();
      const keys = new Set(
        rows.map((row) => `${row.sourceId.toLowerCase()}/${row.slug}`),
      );

      expect(keys.size).toBe(rows.length);
    });
  });

  describe("getSkill", () => {
    it("returns a skill with the ability and prose the aside prints", async () => {
      const perception = await queries.getSkill("PHB", "perception");

      expect(perception).not.toBeNull();
      expect(perception!.name).toBe("Perception");
      expect(perception!.ability).toBe("wis");
      expect(perception!.sourceName).toBe("Player's Handbook");
      expect(
        (perception!.data as { entries?: unknown[] }).entries?.length,
      ).toBeGreaterThan(0);
    });

    /** Source ids are mixed case in the data but lowercase in a URL. */
    it("matches the source case-insensitively", async () => {
      const lower = await queries.getSkill("phb", "stealth");

      expect(lower?.name).toBe("Stealth");
    });

    it("is null for a skill that does not exist", async () => {
      expect(await queries.getSkill("phb", "no-such-skill")).toBeNull();
    });

    /**
     * `generic_entities` holds conditions, actions, senses and the rest beside
     * the skills. Hide is a PHB action; without the entity-type predicate it
     * would answer to a skill lookup and open in the aside as one.
     */
    it("does not reach a generic entity of another type", async () => {
      expect(await queries.getSkill("phb", "hide")).toBeNull();
    });
  });
});
