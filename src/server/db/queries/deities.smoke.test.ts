import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as DeityQueries from "./deities";

/**
 * Smoke test: the deity queries against the seeded data.
 *
 * Every facet here is computed inside the blob rather than from a column, and
 * two of them explode a JSON array to do it. None of that can be checked
 * without real data: a facet that counted `["Knowledge", "War"]` as one value
 * would still typecheck, still return rows, and still look plausible in a rail.
 *
 * The alignment facet is the one to watch. Its value is the codes joined in
 * order — `["C", "G"]` is `CG` — so a query that lost the ordering would give
 * "GC" for some gods and "CG" for others, splitting one alignment into two
 * facet options that each filter half the list.
 *
 * Counts are exact. Ingest runs once and every instance restores the same dump,
 * so a number that moves means the seed was re-cut or a query changed shape.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const DEITIES = 494;
const PANTHEONS = 23;

describeDb("deity queries against the seed", () => {
  let queries: typeof DeityQueries;

  beforeAll(async () => {
    queries = await import("./deities");
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("listDeities", () => {
    it("pages, and reports the whole total behind the page", async () => {
      const first = await queries.listDeities();

      expect(first.total).toBe(DEITIES);
      expect(first.rows).toHaveLength(queries.DEITIES_PER_PAGE);
      expect(first.pageCount).toBe(Math.ceil(DEITIES / queries.DEITIES_PER_PAGE));
      expect(first.page).toBe(1);
    });

    /** A page past the end is clamped rather than served empty. */
    it("clamps a page beyond the last one", async () => {
      const page = await queries.listDeities({ page: 999 });

      expect(page.page).toBe(page.pageCount);
      expect(page.rows).not.toHaveLength(0);
    });

    /**
     * Name alone is not a total order: 60 gods share a name with one from
     * another pantheon, so the second key is what stops those rows reshuffling
     * between two requests for the same page.
     */
    it("orders by name then pantheon", async () => {
      const { rows } = await queries.listDeities();
      const keys = rows.map((row) => `${row.name}|${row.pantheon}`);

      expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    });

    it("narrows by pantheon", async () => {
      const { rows, total } = await queries.listDeities({
        pantheons: ["Dragonlance"],
      });

      expect(total).toBeGreaterThan(0);
      expect(rows.every((row) => row.pantheon === "Dragonlance")).toBe(true);
    });

    it("narrows by domain, which lives in a JSON array", async () => {
      const { rows, total } = await queries.listDeities({ domains: ["Trickery"] });

      expect(total).toBeGreaterThan(0);
      expect(rows.every((row) => row.domains?.includes("Trickery"))).toBe(true);
    });

    it("narrows by the joined alignment code", async () => {
      const { rows, total } = await queries.listDeities({ alignments: ["CG"] });

      expect(total).toBeGreaterThan(0);
      expect(rows.every((row) => row.alignment === "CG")).toBe(true);
    });
  });

  describe("deityFacets", () => {
    it("counts every pantheon, and never more gods than there are", async () => {
      const { pantheons } = await queries.deityFacets();

      expect(pantheons).toHaveLength(PANTHEONS);
      expect(pantheons.every((facet) => facet.count <= DEITIES)).toBe(true);
      expect(pantheons.map((facet) => facet.value)).toContain("Faerûnian");
    });

    /** Exploded, or `["Knowledge", "War"]` would be its own facet value. */
    it("counts each domain separately", async () => {
      const { domains } = await queries.deityFacets();
      const names = domains.map((facet) => facet.value);

      expect(names).toContain("Knowledge");
      expect(names).toContain("War");
      expect(names.every((name) => !name.includes(","))).toBe(true);
    });

    it("labels an alignment code with its words", async () => {
      const { alignments } = await queries.deityFacets();
      const chaoticGood = alignments.find((facet) => facet.value === "CG");

      expect(chaoticGood?.label).toBe("Chaotic Good");
      expect(chaoticGood?.count).toBeGreaterThan(0);
    });

    /**
     * Each facet is counted against the *other* filters, so a selected pantheon
     * must leave its own count intact and match what the list returns.
     */
    it("counts a selected pantheon against the list it produces", async () => {
      const filters = { pantheons: ["Norse"] };
      const [{ total }, { pantheons }] = await Promise.all([
        queries.listDeities(filters),
        queries.deityFacets(filters),
      ]);

      const norse = pantheons.find((facet) => facet.value === "Norse");
      expect(norse?.selected).toBe(true);
      expect(norse?.count).toBe(total);
    });
  });
});
