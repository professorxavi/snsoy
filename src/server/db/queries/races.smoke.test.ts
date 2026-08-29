import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fluffImages } from "@/components/compendium/entity-image";
import type * as RaceQueries from "./races";

/**
 * Smoke test: run the race queries against the seeded database.
 *
 * The rule worth pinning here is the one that is easy to get backwards: races
 * that only exist as NPC stat entries stay out of the index, but keep working
 * as URLs. Cut them from both and inbound links from book text start 404ing;
 * cut them from neither and the index fills with entries no player can pick.
 *
 * Counts are exact. Ingest runs once and every instance restores the same dump,
 * so a number that moves means the seed was re-cut or a query changed shape.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const PLAYABLE = 98;
const ADDRESSABLE = 114;

/** Every subrace a parent's page shows: 69 in the books, less the empty one. */
const SUBRACES = 68;

describeDb("race queries against the seed", () => {
  let queries: typeof RaceQueries;

  beforeAll(async () => {
    queries = await import("./races");
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("listRacesBySource", () => {
    it("groups every playable race under the book that printed it", async () => {
      const groups = await queries.listRacesBySource();
      const total = groups.reduce((n, group) => n + group.races.length, 0);

      expect(groups).toHaveLength(22);
      expect(total).toBe(PLAYABLE);
    });

    /** The book most readers own comes first, not whatever sorts first. */
    it("leads with the Player's Handbook", async () => {
      const [first] = await queries.listRacesBySource();

      expect(first!.sourceId).toBe("PHB");
      expect(first!.races).toHaveLength(9);
    });

    it("leaves no group empty", async () => {
      const groups = await queries.listRacesBySource();

      expect(groups.every((group) => group.races.length > 0)).toBe(true);
      expect(groups.every((group) => group.sourceName.trim() !== "")).toBe(
        true,
      );
    });

    /**
     * Subraces belong to their parent's page. Listing them here would put
     * "Hill" and "Mountain" beside "Dwarf" as if they were peers.
     */
    it("lists parents only, never subraces", async () => {
      const groups = await queries.listRacesBySource();
      const names = groups.flatMap((group) =>
        group.races.map((race) => race.name),
      );

      expect(names).toContain("Dwarf");
      expect(names).not.toContain("Hill");
      expect(names).not.toContain("Mountain");
    });
  });

  describe("getRace", () => {
    it("returns a race with the traits the page prints", async () => {
      const dwarf = await queries.getRace("PHB", "dwarf");

      expect(dwarf).not.toBeNull();
      expect(dwarf!.name).toBe("Dwarf");
      expect(dwarf!.size).toEqual(["M"]);
      expect(dwarf!.speed).toBe(25);
    });

    it("carries the subraces, in name order", async () => {
      const dwarf = await queries.getRace("PHB", "dwarf");
      const slugs = dwarf!.subraces.map((sub) => sub.slug);

      expect(slugs).toEqual(["duergar", "hill", "mark-of-warding", "mountain"]);
    });

    /** The case the disclosure list exists for. */
    it("handles a race with many subraces", async () => {
      const tiefling = await queries.getRace("PHB", "tiefling");

      expect(tiefling!.subraces).toHaveLength(12);
    });

    /**
     * Thirteen bloodlines are filed under the tiefling and one of them,
     * Asmodeus, carries nothing at all — no size, no speed, no ability spread,
     * no traits. It exists to say the *Player's Handbook* tiefling was always
     * his. Rendered, it is an empty disclosure that implies a choice.
     */
    it("drops a subrace that carries no rules of its own", async () => {
      const tiefling = await queries.getRace("PHB", "tiefling");
      const names = tiefling!.subraces.map((sub) => sub.name);

      expect(names).not.toContain("Asmodeus");
      expect(names).toContain("Zariel");
    });

    /**
     * The books file a subrace's flavour under the name of the pair —
     * "Tiefling (Glasya)" — so it was never found and a subrace read as
     * nothing but its numbers.
     */
    it("carries the prose that says what a subrace is", async () => {
      const tiefling = await queries.getRace("PHB", "tiefling");
      const glasya = tiefling!.subraces.find((sub) => sub.name === "Glasya");

      expect(JSON.stringify(glasya!.fluff)).toContain(
        "Hell's criminal mastermind",
      );
    });

    /** The parent's own entry is not repeated inside each of its subraces. */
    it("keeps a subrace's prose to the subrace", async () => {
      const tiefling = await queries.getRace("PHB", "tiefling");
      const glasya = tiefling!.subraces.find((sub) => sub.name === "Glasya");

      expect(JSON.stringify(glasya!.fluff).length).toBeLessThan(
        JSON.stringify(tiefling!.fluff).length / 4,
      );
    });

    /** 24 of the 69 have no record in the books at all. */
    it("leaves a subrace the books say nothing about without prose", async () => {
      const tiefling = await queries.getRace("PHB", "tiefling");
      const winged = tiefling!.subraces.find(
        (sub) => sub.name === "Variant; Winged",
      );

      expect(winged!.fluff).toBeNull();
    });

    /** The rule is emptiness, and today exactly one subrace is empty. */
    it("keeps every other subrace in the books", async () => {
      const groups = await queries.listRacesBySource();
      const parents = groups.flatMap((group) => group.races);
      const found = await Promise.all(
        parents.map((race) => queries.getRace(race.sourceId, race.slug)),
      );
      const total = found.reduce((n, race) => n + race!.subraces.length, 0);

      expect(total).toBe(SUBRACES);
    });

    /**
     * 46 races across seven books state no ability spread at all — they defer
     * to the rule the books print once and mark with `lineage`. Read as the
     * data comes, every one of them showed no ability line whatsoever.
     */
    it("carries the lineage a race defers to", async () => {
      const aarakocra = await queries.getRace("MPMM", "aarakocra");

      expect(aarakocra!.ability).toBeNull();
      expect(aarakocra!.lineage).toBe("VRGR");
    });

    it("leaves a race that states its own spread with no lineage", async () => {
      const dwarf = await queries.getRace("PHB", "dwarf");

      expect(dwarf!.lineage).toBeNull();
      expect(dwarf!.ability).not.toBeNull();
    });

    it("is null for a race that does not exist", async () => {
      expect(await queries.getRace("phb", "no-such-race")).toBeNull();
    });

    /** Slugs are unique per source, not globally. */
    it("does not reach a race of a different source", async () => {
      const groups = await queries.listRacesBySource();
      const nonPhb = groups.find((group) => group.sourceId !== "PHB")!;
      const slug = nonPhb.races[0]!.slug;

      expect(await queries.getRace("PHB", slug)).toBeNull();
    });
  });

  describe("allRaceParams", () => {
    /**
     * More addressable races than listed ones, and deliberately so: the
     * difference is the NPC-only entries that book text still links to.
     */
    it("addresses more races than the index lists", async () => {
      const params = await queries.allRaceParams();

      expect(params).toHaveLength(ADDRESSABLE);
      expect(params.length).toBeGreaterThan(PLAYABLE);
    });

    it("covers everything the index does list", async () => {
      const [params, groups] = await Promise.all([
        queries.allRaceParams(),
        queries.listRacesBySource(),
      ]);
      const addressable = new Set(params.map((p) => `${p.source}/${p.slug}`));

      for (const group of groups) {
        for (const race of group.races) {
          expect(
            addressable.has(`${group.sourceId.toLowerCase()}/${race.slug}`),
          ).toBe(true);
        }
      }
    });

    /**
     * The route-map invariant against real data: `/compendium/races/[source]/
     * [slug]` addresses exactly one race, and source ids are lowercased into
     * the URL, so the pair has to stay unique after that.
     */
    it("gives every race a URL of its own", async () => {
      const params = await queries.allRaceParams();
      const urls = new Set(params.map((p) => `${p.source}/${p.slug}`));

      expect(urls.size).toBe(params.length);
      expect(params.every((p) => p.source === p.source.toLowerCase())).toBe(
        true,
      );
    });
  });

  /**
   * Every illustration a race page would render, checked against the disk it
   * would render from.
   *
   * Ingest copied image paths out of the books; nothing has ever confirmed
   * they point at files. A path that does not resolve is a broken image on a
   * reading page, and the page itself renders perfectly — so this cannot be
   * caught by looking at the markup.
   *
   * Needs the image set, which is several gigabytes and lives outside the
   * repo, so it skips when `CONTENT_IMAGE_DIR` is unset.
   */
  describe("race illustrations", () => {
    const imageDir = process.env.CONTENT_IMAGE_DIR;
    const itWithImages = imageDir ? it : it.skip;

    itWithImages("resolve to files that exist", async () => {
      const params = await queries.allRaceParams();
      const races = await Promise.all(
        params.map((p) => queries.getRace(p.source, p.slug)),
      );

      const paths = races.flatMap((race) =>
        fluffImages(race?.fluff).map((image) => image.href?.path),
      );
      const missing = paths.filter(
        (path) => path && !existsSync(join(imageDir!, path)),
      );

      expect(paths.filter(Boolean).length).toBeGreaterThan(0);
      expect(missing).toEqual([]);
    });
  });
});
