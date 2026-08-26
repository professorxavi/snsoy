import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { groupByBook } from "@/lib/content/chapters";
import type * as SourceQueries from "./sources";

/**
 * Smoke test: run the source queries against the seeded database.
 *
 * Unit tests prove the shaping functions in isolation, but the rules they
 * implement are only worth anything if the rows arrive in the order the queries
 * promise — and that order lives in SQL, not TypeScript. This is the check that
 * catches an ordering clause regressing.
 *
 * Counts are exact on purpose. Ingest runs once and every instance is built by
 * restoring the same dump, so a number that moves means either the seed was
 * re-cut or a query started including rows it should not.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("source queries against the seed", () => {
  let queries: typeof SourceQueries;

  // Imported late: the module reaches the env schema through the db client,
  // which throws at import time when DATABASE_URL is missing.
  beforeAll(async () => {
    queries = await import("./sources");
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("listSources", () => {
    it("lists every source that has body text", async () => {
      const all = await queries.listSources();

      expect(all).toHaveLength(84);
      expect(all.filter((source) => !source.isAdventure)).toHaveLength(34);
      expect(all.filter((source) => source.isAdventure)).toHaveLength(50);
    });

    /**
     * The 10 sources ingest synthesised from citations have no name, cover or
     * body. Their pages still resolve, but a card for one would be a dead end.
     *
     * Tales from the Yawning Portal is no longer among them: the anthology is
     * cited by its own creatures and its seven bodies merge into it, so ingest
     * gives that row the book`s name and cover.
     */
    it("hides synthesised sources", async () => {
      const all = await queries.listSources();

      expect(all.some((source) => source.group === "unlisted")).toBe(false);
      expect(all.some((source) => source.id === "MFF")).toBe(false);
      expect(all.every((source) => source.chapterCount > 0)).toBe(true);
    });

    it("leads with the core rulebooks", async () => {
      const all = await queries.listSources();

      expect(all.slice(0, 3).map((source) => source.id)).toEqual([
        "PHB",
        "MM",
        "DMG",
      ]);
    });

    /**
     * The core three are the only books whose place is not their date — Lost
     * Mine of Phandelver was printed a month before the Player's Handbook.
     */
    it("runs chronologically once past the core rulebooks", async () => {
      const all = await queries.listSources();
      const dates = all
        .filter((source) => source.group !== "core")
        .map((source) => source.published);

      expect(dates).toEqual([...dates].sort());
      expect(dates[0]!.startsWith("2014")).toBe(true);
    });

    /**
     * Four books can share a release date and still have an order. The three
     * sequels to Dragon of Icespire Peak all shipped on one day and are played
     * one after another, which only the data's own listing order records — by
     * name they would read Divine Contention first.
     */
    it("keeps a sequence in its own order, not alphabetical", async () => {
      const all = await queries.listSources();
      const ids = all.map((source) => source.id);
      const at = (id: string) => ids.indexOf(id);

      expect(at("DIP")).toBeLessThan(at("SLW"));
      expect(at("SLW")).toBeLessThan(at("SDW"));
      expect(at("SDW")).toBeLessThan(at("DC"));
    });

    it("counts only chapters, not every entity in the source", async () => {
      const all = await queries.listSources();
      const phb = all.find((source) => source.id === "PHB");

      // PHB holds thousands of spells and items alongside its 16 chapters.
      expect(phb?.chapterCount).toBe(16);
    });
  });

  describe("getSource", () => {
    it("returns a book with its chapters in printed order", async () => {
      const phb = await queries.getSource("phb");

      expect(phb?.name).toBe("Player's Handbook");
      expect(phb?.chapters).toHaveLength(16);
      expect(phb?.chapters.map((chapter) => chapter.ordinalLabel)).toEqual([
        null, "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
        "A", "B", "C", null,
      ]);
      expect(phb?.chapters.at(0)?.slug).toBe("introduction");
      expect(phb?.chapters.at(-1)?.slug).toBe("credits");
    });

    it("accepts the lowercased id the URL carries", async () => {
      const lower = await queries.getSource("mot");
      const upper = await queries.getSource("MOT");

      expect(lower?.id).toBe("MOT");
      expect(upper).toEqual(lower);
    });

    /**
     * The ordering rule that cannot be expressed as `ORDER BY ordinal`: MOT
     * contains a second body whose ordinals restart at zero, so sorting by
     * ordinal alone interleaves the two books wrongly. It reads at page 184,
     * inside the book's own run, and belongs there rather than after it.
     */
    it("reads an inner work at the page it was printed on", async () => {
      const mot = await queries.getSource("mot");

      expect(
        mot?.chapters.map((chapter) => `${chapter.bookId}:${chapter.slug}`),
      ).toEqual([
        "MOT:welcome-to-theros",
        "MOT:character-creation",
        "MOT:gods-of-theros",
        "MOT:realms-of-gods-and-mortals",
        "MOT:creating-theros-adventures",
        "MOT-NSS:no-silent-secret",
        "MOT:treasures",
        "MOT:friends-and-foes",
        "MOT-NSS:credits",
      ]);
    });

    /** One book, however many bodies the data split its chapters across. */
    it("groups that source into a single body", async () => {
      const mot = await queries.getSource("mot");
      const bodies = groupByBook(mot!.chapters, mot!.id);

      expect(bodies.map((body) => body.bookId)).toEqual(["MOT"]);
      expect(bodies.map((body) => body.chapters.length)).toEqual([9]);
    });

    /** Cited by entities, never published as a book — the page says so. */
    it("resolves a synthesised source with no chapters", async () => {
      const mff = await queries.getSource("mff");

      expect(mff).not.toBeNull();
      expect(mff?.chapters).toEqual([]);
    });

    it("is null for a source that does not exist", async () => {
      expect(await queries.getSource("no-such-book")).toBeNull();
    });
  });

  describe("getChapter", () => {
    it("returns the chapter with its body and its place in the book", async () => {
      const combat = await queries.getChapter("phb", "combat");

      expect(combat?.name).toBe("Combat");
      expect(combat?.sourceName).toBe("Player's Handbook");
      expect(combat?.ordinalLabel).toBe("9");
      expect(combat?.data).toBeTruthy();
    });

    it("walks to the chapters either side", async () => {
      const combat = await queries.getChapter("phb", "combat");

      expect(combat?.previous?.slug).toBe("adventuring");
      expect(combat?.next?.slug).toBe("spellcasting");
    });

    it("stops at both ends of a book", async () => {
      const first = await queries.getChapter("phb", "introduction");
      const last = await queries.getChapter("phb", "credits");

      expect(first?.previous).toBeNull();
      expect(last?.next).toBeNull();
    });

    /** Walking through MOT crosses between its two bodies without noticing. */
    it("crosses the seam into an inner work in both directions", async () => {
      const before = await queries.getChapter(
        "mot",
        "creating-theros-adventures",
      );
      const inner = await queries.getChapter("mot", "no-silent-secret");

      expect(before?.next?.slug).toBe("no-silent-secret");
      expect(inner?.previous?.slug).toBe("creating-theros-adventures");
      expect(inner?.next?.slug).toBe("treasures");
    });

    it("is null for a chapter that does not exist", async () => {
      expect(await queries.getChapter("phb", "no-such-chapter")).toBeNull();
    });

    /** Slugs are unique per source, not globally — "credits" is in most books. */
    it("does not reach a chapter of a different source", async () => {
      expect(await queries.getChapter("dmg", "combat")).toBeNull();
    });
  });

  describe("allChapterParams", () => {
    it("covers every book section", async () => {
      expect(await queries.allChapterParams()).toHaveLength(829);
    });

    /**
     * The route-map invariant, checked against real data: `/sources/[source]/
     * [chapter]` addresses exactly one chapter. Source ids are lowercased into
     * the URL, so the pair has to stay unique after that.
     */
    it("gives every chapter a URL of its own", async () => {
      const params = await queries.allChapterParams();
      const urls = new Set(params.map((p) => `${p.source}/${p.chapter}`));

      expect(urls.size).toBe(params.length);
      expect(params.every((p) => p.source === p.source.toLowerCase())).toBe(
        true,
      );
    });
  });

  /**
   * Every book cover the index renders, checked against the disk it renders
   * from.
   *
   * Ingest copied these paths out of the books; nothing has confirmed they
   * point at files. A path that does not resolve is a broken cover on the
   * index, and the page renders perfectly around it — so no amount of looking
   * at the markup finds this.
   *
   * Needs the image set, which lives outside the repo, so it skips when
   * `CONTENT_IMAGE_DIR` is unset.
   */
  describe("book covers", () => {
    const imageDir = process.env.CONTENT_IMAGE_DIR;
    const itWithImages = imageDir ? it : it.skip;

    itWithImages("resolve to files that exist", async () => {
      const all = await queries.listSources();
      const paths = all
        .map((source) => source.coverPath)
        .filter((path): path is string => Boolean(path));

      const missing = paths.filter(
        (path) => !existsSync(join(imageDir!, path)),
      );

      expect(paths.length).toBeGreaterThan(0);
      expect(missing).toEqual([]);
    });
  });
});
