import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  collectFeatureReferences,
  featureOrder,
  progressionColumns,
} from "@/lib/content/classes";
import { fluffImages } from "@/components/compendium/entity-image";
import { subjectSide } from "@/lib/content/media";
import {
  collectOptionalFeatures,
  optionalFeatureProgressions,
} from "@/lib/content/optional-features";
import type * as ClassQueries from "./classes";
import {
  listOptionalFeaturesByKey,
  listOptionalFeaturesByType,
} from "./optional-features";

/**
 * Smoke test: run the class queries against the seeded database.
 *
 * The rule worth pinning here is the one a source filter would silently break.
 * A class collects rows printed years apart in other books — a PHB Fighter has
 * seven of its ten archetypes from four later supplements, and a feature from
 * Tasha's — and all of them hang off `class_id`, not off the source. Narrow
 * either query to the class's own book and the page still renders, complete and
 * plausible, missing most of the class.
 *
 * Counts are exact. Ingest runs once and every instance restores the same dump,
 * so a number that moves means the seed was re-cut or a query changed shape.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const CLASSES = 16;

describeDb("class queries against the seed", () => {
  let queries: typeof ClassQueries;

  beforeAll(async () => {
    queries = await import("./classes");
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("listClassesBySource", () => {
    it("groups every class under the book that printed it", async () => {
      const groups = await queries.listClassesBySource();
      const total = groups.reduce((n, group) => n + group.classes.length, 0);

      expect(total).toBe(CLASSES);
      expect(groups[0]!.sourceId).toBe("PHB");
      expect(groups[0]!.classes).toHaveLength(12);
    });

    it("counts a class's subclasses across every book that added one", async () => {
      const groups = await queries.listClassesBySource();
      const fighter = groups
        .flatMap((group) => group.classes)
        .find((entry) => entry.slug === "fighter");

      expect(fighter?.subclassCount).toBe(10);
      expect(fighter?.subclassTitle).toBe("Martial Archetype");
    });
  });

  describe("getClass", () => {
    it("finds a class by a lowercased source id, as the URL carries it", async () => {
      expect(await queries.getClass("phb", "fighter")).not.toBeNull();
      expect(await queries.getClass("PHB", "fighter")).not.toBeNull();
      expect(await queries.getClass("phb", "no-such-class")).toBeNull();
    });

    /** The feature a later book adds to an earlier book's class. */
    it("keeps a feature printed in another book", async () => {
      const fighter = (await queries.getClass("phb", "fighter"))!;
      const versatility = fighter.features.find(
        (feature) => feature.name === "Martial Versatility",
      );

      expect(fighter.features).toHaveLength(23);
      expect(versatility?.sourceId).toBe("TCE");
      expect(versatility?.level).toBe(4);
    });

    /** Base features only. A subclass's features belong under the subclass. */
    it("separates base features from the subclasses' own", async () => {
      const fighter = (await queries.getClass("phb", "fighter"))!;

      expect(fighter.features.every((feature) => !feature.subclassId)).toBe(true);
      expect(fighter.subclasses).toHaveLength(10);
      expect(
        fighter.subclasses.map((subclass) => subclass.sourceId),
      ).toContain("XGE");

      const champion = fighter.subclasses.find((s) => s.slug === "champion")!;
      expect(champion.features).toHaveLength(6);
      expect(champion.features.every((f) => f.subclassId === champion.id)).toBe(
        true,
      );
    });

    /**
     * The two things the class page is built out of, checked on the class that
     * exercises both hardest: thirteen columns and twenty rows of spell slots.
     */
    it("carries a caster's whole progression in its data", async () => {
      const wizard = (await queries.getClass("phb", "wizard"))!;
      const columns = progressionColumns(wizard.data);

      expect(columns).toHaveLength(10);
      expect(columns.at(-1)!.group).toBe("Spell Slots per Spell Level");
      // 9th-level slots arrive at 17th level and never exceed one.
      expect(columns.at(-1)!.values.slice(16)).toEqual(["1", "1", "1", "1"]);

      expect(featureOrder(wizard.data).get("Spellcasting")).toBeDefined();
    });
  });

  /**
   * The options a class chooses between, which reach the page two ways.
   *
   * Ten of the thirteen progressions in the corpus are already named inline by
   * the feature that offers them; three are named nowhere at all. Both numbers
   * matter: lose the first route and a Fighter's fighting styles vanish from
   * the feature that introduces them, lose the second and a Warlock's page
   * mentions 54 invocations without printing one.
   */
  describe("optional features", () => {
    it("finds every option a class names by reference", async () => {
      const fighter = (await queries.getClass("phb", "fighter"))!;
      const keys = collectOptionalFeatures(
        fighter.features.map((feature) => feature.data),
      );
      const rows = await listOptionalFeaturesByKey([...keys]);

      // Six fighting styles in the PHB, five added by later books.
      expect(rows).toHaveLength(11);
      expect(rows.map((row) => row.name)).toContain("Archery");
      expect(rows.some((row) => row.sourceId === "TCE")).toBe(true);
    });

    it("finds a whole kind of option for a class that names none", async () => {
      const warlock = (await queries.getClass("phb", "warlock"))!;
      const [progression] = optionalFeatureProgressions(warlock.data);

      expect(progression!.featureTypes).toEqual(["EI"]);
      expect(progression!.known).toMatch(/^Two at 2nd level/);

      const named = collectOptionalFeatures(
        warlock.features.map((feature) => feature.data),
      );
      const rows = await listOptionalFeaturesByType(progression!.featureTypes);

      expect(rows).toHaveLength(54);
      expect(rows.some((row) => row.name === "Agonizing Blast")).toBe(true);

      // Not one invocation is named in the class's own text, which is why the
      // list exists. The four options it does name are its pact boons, and
      // those print under the feature that names them instead.
      expect(rows.filter((row) => named.has(row.naturalKey))).toEqual([]);
      expect(named.size).toBe(4);
    });

    /** A subclass draws on its own kind: a Battle Master's 23 maneuvers. */
    it("finds the options a subclass adds", async () => {
      const fighter = (await queries.getClass("phb", "fighter"))!;
      const battleMaster = fighter.subclasses.find(
        (subclass) => subclass.slug === "battle-master",
      )!;
      const [progression] = optionalFeatureProgressions(battleMaster.data);

      expect(progression!.name).toBe("Maneuvers");
      expect(await listOptionalFeaturesByType(progression!.featureTypes)).toHaveLength(23);
    });

    it("resolves every option the corpus names, from every class", async () => {
      const classes = await queries.listClassesBySource();
      const keys = new Set<string>();

      for (const entry of classes.flatMap((group) => group.classes)) {
        const found = (await queries.getClass(entry.sourceId, entry.slug))!;
        for (const key of collectOptionalFeatures([
          found.data,
          ...found.features.map((feature) => feature.data),
          ...found.subclasses.flatMap((subclass) => [
            subclass.data,
            ...subclass.features.map((feature) => feature.data),
          ]),
        ])) {
          keys.add(key);
        }
      }

      // A key that resolves to nothing renders as a bare name under a feature
      // telling the reader to choose something.
      expect(await listOptionalFeaturesByKey([...keys])).toHaveLength(keys.size);
      expect(keys.size).toBe(81);
    });
  });

  /**
   * A feature composed out of other features resolves them against what the
   * page already holds, with no second query. That only works because every
   * reference in the corpus points at a feature of the same class — 343 of
   * them, all resolved from the three lists a class page loads. One that
   * pointed elsewhere would render as nothing, and the feature it names would
   * be gone from the page entirely: referenced features are dropped from the
   * flat list on the grounds that they print inside their parent.
   */
  it("keeps every feature reference inside the class that makes it", async () => {
    const classes = await queries.listClassesBySource();
    let references = 0;

    for (const entry of classes.flatMap((group) => group.classes)) {
      const found = (await queries.getClass(entry.sourceId, entry.slug))!;
      const loaded = new Set(
        [
          ...found.features,
          ...found.subclasses.flatMap((subclass) => subclass.features),
        ].map((feature) => feature.naturalKey),
      );

      const referenced = collectFeatureReferences([
        ...found.features.map((feature) => feature.data),
        ...found.subclasses.flatMap((subclass) =>
          subclass.features.map((feature) => feature.data),
        ),
      ]);

      expect([...referenced].filter((key) => !loaded.has(key))).toEqual([]);
      references += referenced.size;
    }

    expect(references).toBe(343);
  });

  /**
   * The class page places its art in a corner and crops it to a square, which
   * only works while the four pictures built against the left edge are known
   * by name. A renamed or re-cut image would not break anything visibly — it
   * would quietly fall back to a centre crop, and take the head off a Bard, a
   * Ranger, a Sorcerer and a Warlock.
   */
  it("crops the class art from the side its subject stands on", async () => {
    const sides = new Map<string, string>();
    const classes = await queries.listClassesBySource();

    for (const entry of classes.flatMap((group) => group.classes)) {
      const found = (await queries.getClass(entry.sourceId, entry.slug))!;
      const [art] = fluffImages(found.fluff);
      if (art) sides.set(found.name, subjectSide(art));
    }

    // Every class carries art, so every class page places one.
    expect(sides.size).toBe(CLASSES);
    expect(
      [...sides].filter(([, side]) => side === "left").map(([name]) => name).sort(),
    ).toEqual(["Bard", "Ranger", "Sorcerer", "Warlock"]);
  });

  it("addresses every class in the corpus", async () => {
    const params = await queries.allClassParams();

    expect(params).toHaveLength(CLASSES);
    expect(new Set(params.map((p) => `${p.source}/${p.slug}`)).size).toBe(
      CLASSES,
    );
  });
});
