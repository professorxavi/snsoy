import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as BackgroundQueries from "./backgrounds";
import type * as FeatQueries from "./feats";
import type * as OptionalFeatureQueries from "./optional-features";

/**
 * Smoke test: the player-option query modules against the seeded data.
 *
 * One file for three modules, because what is under test is largely the same
 * thing twice: a facet counted over a `text[]` column with a LATERAL unnest.
 * That is the shape a unit test cannot check — a facet that counted the array
 * itself would report `{insight,religion}` as a value and still typecheck,
 * still return rows, and still look plausible in a rail.
 *
 * The second thing only real data answers is whether the counts *narrow*
 * correctly: each facet is counted against the other filters, so selecting one
 * option must leave the others' counts consistent with the list it produces.
 *
 * Counts are exact. Ingest runs once and every instance restores the same dump,
 * so a number that moves means the seed was re-cut or a query changed shape.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const BACKGROUNDS = 96;
const FEATS = 105;
const INVOCATIONS = 54;

describeDb("player option queries against the seed", () => {
  let backgrounds: typeof BackgroundQueries;
  let feats: typeof FeatQueries;
  let options: typeof OptionalFeatureQueries;

  beforeAll(async () => {
    [backgrounds, feats, options] = await Promise.all([
      import("./backgrounds"),
      import("./feats"),
      import("./optional-features"),
    ]);
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("backgrounds", () => {
    it("returns every background, name then source", async () => {
      const rows = await backgrounds.listBackgrounds();

      expect(rows).toHaveLength(BACKGROUNDS);
      expect(rows.map((row) => row.name)).toEqual(
        [...rows.map((row) => row.name)].sort((a, b) => a.localeCompare(b)),
      );
    });

    /**
     * The facet counts backgrounds, not skill slots. A background grants two
     * skills, so the unnested rows outnumber the backgrounds nearly two to one
     * — and a count that had drifted into counting slots would exceed the list.
     */
    it("counts backgrounds per skill, never more than the list holds", async () => {
      const { skills } = await backgrounds.backgroundFacets();

      expect(skills).not.toHaveLength(0);
      expect(skills.every((facet) => facet.count <= BACKGROUNDS)).toBe(true);
      expect(skills.map((facet) => facet.value)).toContain("stealth");
    });

    it("narrows to the skill asked for, and says so in the facet", async () => {
      const filters = { skills: ["stealth"] };
      const [rows, facets] = await Promise.all([
        backgrounds.listBackgrounds(filters),
        backgrounds.backgroundFacets(filters),
      ]);

      expect(rows).not.toHaveLength(0);
      expect(rows.every((row) => row.skills?.includes("stealth"))).toBe(true);

      const stealth = facets.skills.find((facet) => facet.value === "stealth");
      expect(stealth?.selected).toBe(true);
      expect(stealth?.count).toBe(rows.length);
    });

    it("finds one by source and slug, however the source is cased", async () => {
      const [first] = await backgrounds.listBackgrounds({ q: "acolyte" });
      const found = await backgrounds.getBackground(
        first!.sourceId.toLowerCase(),
        first!.slug,
      );

      expect(found?.name).toBe(first!.name);
      expect(found?.data).toBeTruthy();
    });
  });

  describe("feats", () => {
    it("returns every feat", async () => {
      expect(await feats.listFeats()).toHaveLength(FEATS);
    });

    /**
     * A feat offering a free choice carries all six abilities, so the six
     * counts overlap heavily — which is the point of unnesting rather than
     * grouping on the column.
     */
    it("counts feats per ability raised", async () => {
      const { abilities } = await feats.featFacets();

      expect(abilities.map((facet) => facet.value)).toEqual([
        "str",
        "dex",
        "con",
        "int",
        "wis",
        "cha",
      ]);
      expect(abilities.every((facet) => facet.count > 0)).toBe(true);
    });

    it("narrows to feats raising the ability asked for", async () => {
      const rows = await feats.listFeats({ abilities: ["dex"] });

      expect(rows).not.toHaveLength(0);
      expect(rows.every((row) => row.abilities?.includes("dex"))).toBe(true);
    });

    /** The useful half of a prerequisite: whether there is one at all. */
    it("narrows to feats anyone can take, and counts them", async () => {
      const rows = await feats.listFeats({ open: true });
      const { open } = await feats.featFacets({ open: true });

      expect(rows).not.toHaveLength(0);
      expect(rows.every((row) => row.prerequisites == null)).toBe(true);
      expect(open.count).toBe(rows.length);
      expect(open.selected).toBe(true);
    });
  });

  /**
   * Two readers, not the three there used to be: the browse list was cut on
   * 2026-08-25, so an option is met on a class page or in the aside and never
   * looked up cold. `classes.smoke.test.ts` covers the by-key reader against a
   * real progression; what is left here is the kind reader and the aside's.
   */
  describe("optional features", () => {
    it("returns every option of a kind", async () => {
      const rows = await options.listOptionalFeaturesByType(["EI"]);

      expect(rows).toHaveLength(INVOCATIONS);
      expect(rows.every((row) => row.featureTypes?.includes("EI"))).toBe(true);
    });

    it("finds one by source and slug, which is how the aside opens it", async () => {
      const found = await options.getOptionalFeature("phb", "agonizing-blast");

      expect(found?.name).toBe("Agonizing Blast");
      expect(found?.featureTypes).toContain("EI");
    });
  });
});
