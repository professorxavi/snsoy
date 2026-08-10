import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as GenericQueries from "./generic";

/**
 * Smoke test: run the generic-entity queries against the seeded database.
 *
 * Three things here can only be checked against real data:
 *
 * - **The type predicate.** All 22 generic types share one table, so it is the
 *   predicate alone that keeps a query for a sense from answering with an
 *   action. Nothing below the database can tell whether it survived being made
 *   a parameter.
 * - **The field map reaching the blob.** The JSON key travels as a bound
 *   parameter, so a key that never matches returns null rather than failing —
 *   a silent shape a unit test would have to fake, and faking it proves nothing.
 * - **The order being total.** Languages repeat their names across books, which
 *   is exactly the case a made-up fixture would not have.
 *
 * Counts are exact. Ingest runs once and every instance restores the same dump,
 * so a number that moves means the seed was re-cut or a query changed shape.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

/** Measured against the seed. See the note on exact counts above. */
const COUNTS = {
  sense: 4,
  status: 2,
  action: 30,
  variantrule: 115,
  language: 135,
} as const;

describeDb("generic entity queries against the seed", () => {
  let queries: typeof GenericQueries;

  beforeAll(async () => {
    queries = await import("./generic");
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("listGeneric", () => {
    it.each(Object.entries(COUNTS))(
      "returns every %s and nothing of another type",
      async (type, count) => {
        const rows = await queries.listGeneric(
          type as keyof typeof COUNTS,
          {},
        );

        expect(rows).toHaveLength(count);
      },
    );

    /**
     * The predicate's whole job, stated as the collision it prevents. Celestial
     * is a language in four books and a card in two others — so a list that
     * lost the predicate would still come back full of plausible rows.
     */
    it("keeps apart types that share a name", async () => {
      const [languages, cards] = await Promise.all([
        queries.listGeneric("language", {}, "Celestial"),
        queries.listGeneric("card", {}, "Celestial"),
      ]);

      expect(languages.length).toBeGreaterThan(0);
      expect(cards.length).toBeGreaterThan(0);

      const overlap = languages.filter((language) =>
        cards.some((card) => card.id === language.id),
      );
      expect(overlap).toEqual([]);
    });

    it("reads mapped keys out of the blob", async () => {
      const rows = await queries.listGeneric(
        "language",
        { kind: "type", script: "script" },
        "Elvish",
      );

      expect(rows[0]).toMatchObject({
        name: "Elvish",
        kind: "standard",
        script: "Elvish",
      });
    });

    /** A key no row carries is null, not absent — every row keeps its shape. */
    it("returns null for a key the type does not have", async () => {
      const rows = await queries.listGeneric("sense", { nope: "notAKey" });

      expect(rows).toHaveLength(COUNTS.sense);
      expect(rows.every((row) => row.nope === null)).toBe(true);
    });

    /**
     * Name is not a total order for languages: three books each define a
     * language called Common. Source breaks the tie, so the list is stable.
     */
    it("orders by name then source, which repeated names need", async () => {
      const rows = await queries.listGeneric("language", {}, "Common");
      const common = rows.filter((row) => row.name === "Common");

      expect(common.length).toBeGreaterThan(1);
      expect(common.map((row) => row.sourceId)).toEqual(
        [...common.map((row) => row.sourceId)].sort(),
      );
    });

    it("narrows by name, case-insensitively and anywhere in the name", async () => {
      const rows = await queries.listGeneric("variantrule", {}, "spellcast");

      expect(rows.length).toBeGreaterThan(0);
      expect(
        rows.every((row) => /spellcast/i.test(row.name)),
      ).toBe(true);
    });
  });

  describe("getGeneric", () => {
    it("returns one entity with its blob and its source's name", async () => {
      const row = await queries.getGeneric("sense", "phb", "darkvision", {});

      expect(row).toMatchObject({
        name: "Darkvision",
        slug: "darkvision",
        sourceName: "Player's Handbook",
      });
      expect(row!.data).toHaveProperty("entries");
    });

    /** Source ids are mixed case in the data and lowercase in every URL. */
    it("matches a lowercase source id from the URL", async () => {
      const row = await queries.getGeneric("sense", "PHB", "darkvision", {});

      expect(row?.name).toBe("Darkvision");
    });

    /**
     * The predicate carrying a URL, which is where it matters most: the DMG
     * defines a card called Goblin and no language of that name, so
     * `/languages/dmg/goblin` must be nothing at all. Source and slug alone
     * would have found the card and served it as a language.
     */
    it("will not serve one type's slug as another's", async () => {
      const asCard = await queries.getGeneric("card", "dmg", "goblin", {});
      const asLanguage = await queries.getGeneric("language", "dmg", "goblin", {});

      expect(asCard?.name).toBe("Goblin");
      expect(asLanguage).toBeNull();
    });

    it("returns null for a slug the type does not have", async () => {
      expect(await queries.getGeneric("sense", "phb", "fireball", {})).toBeNull();
    });
  });
});
