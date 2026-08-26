import { describe, expect, it } from "vitest";
import { collectAreaTargets } from "@/lib/content/references";
import type * as ReferenceQueries from "./references";

/**
 * Smoke test: resolve `{@area}` anchors against the seeded database.
 *
 * `{@area}` is the only tag that addresses a position inside a chapter rather
 * than an entity, so nothing in `entities` can confirm a target exists — the
 * check has to walk the book's own sections. What this pins is the split the
 * whole design rests on: 84% of area tags point at the page they are written
 * on and 16% at another chapter, and a page cannot know it is a target by
 * reading its own text.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("area anchors against the seed", () => {
  const load = async () => {
    // Imported late: the module reaches the env schema through the db client,
    // which throws at import time when DATABASE_URL is missing.
    const queries: typeof ReferenceQueries = await import("./references");
    return queries;
  };

  it("resolves a target on the page it is written on to a bare fragment", async () => {
    const { resolveAreas } = await load();
    const { hrefs } = await resolveAreas("ToA", "random-encounters", ["59f"]);

    expect(hrefs["59f"]).toBe("#59f");
  });

  /** ToA's random encounter tables cite a map printed two chapters earlier. */
  it("resolves a target in another chapter to that chapter's URL", async () => {
    const { resolveAreas } = await load();
    const { hrefs } = await resolveAreas("ToA", "random-encounters", ["159"]);

    expect(hrefs["159"]).toBe("/sources/toa/the-land-of-chult#159");
  });

  it("leaves an id the book does not carry unresolved", async () => {
    const { resolveAreas } = await load();
    const { hrefs } = await resolveAreas("ToA", "random-encounters", ["zzz"]);

    expect(hrefs["zzz"]).toBeUndefined();
  });

  /**
   * The half that is easy to get wrong: the page holding the target is not the
   * page holding the tag, so it has to be told which of its nodes to mark.
   */
  it("marks a chapter as a target of a tag written in another chapter", async () => {
    const { resolveAreas } = await load();
    const { anchored } = await resolveAreas("ToA", "the-land-of-chult", []);

    expect(anchored["159"]).toBe(true);
  });

  it("has nothing to mark in a book that writes no area tags", async () => {
    const { resolveAreas } = await load();
    const { anchored, hrefs } = await resolveAreas("PHB", "equipment", []);

    expect(anchored).toEqual({});
    expect(hrefs).toEqual({});
  });

  /**
   * Every area target in the books resolves — measured at 11,393 tags, none
   * dangling — so an unresolved one means the walk stopped short, not that the
   * data is incomplete.
   */
  it("resolves every area target ToA's encounter tables write", async () => {
    const { resolveAreas } = await load();
    const { getChapter } = await import("./sources");

    const chapter = await getChapter("toa", "random-encounters");
    const wanted = [...collectAreaTargets(chapter?.data)];
    const { hrefs } = await resolveAreas("ToA", "random-encounters", wanted);

    expect(wanted.length).toBeGreaterThan(90);
    expect(wanted.filter((id) => !hrefs[id])).toEqual([]);
  });
});
