import { describe, expect, it } from "vitest";
import { DIRECTORY, entryHref, IMPLEMENTED } from "./compendium-directory";
import { BROWSABLE_TYPES, listHrefFor, segmentFor } from "./routes";

/**
 * The index and the route map have to agree.
 *
 * The failure this guards against is quiet: someone adds a browsable type, the
 * route works, and it is reachable only by typing the URL because nothing ever
 * pointed at it. A test is the only thing that notices.
 */

const entries = DIRECTORY.flatMap((group) => group.entries);

/** Cards that browse a whole type, as opposed to a slice of one. */
const typed = entries.flatMap((entry) => (entry.type ? [entry] : []));

describe("the directory covers the route map", () => {
  it("lists every browsable type exactly once", () => {
    const listed = typed.map((entry) => entry.type).sort();
    expect(listed).toEqual([...BROWSABLE_TYPES].sort());
  });

  it("has no duplicates across groups", () => {
    const listed = typed.map((entry) => entry.type);
    expect(new Set(listed).size).toBe(listed.length);
  });

  /** Fragments render on a parent page, so they must never appear here. */
  it("omits types with no browse route of their own", () => {
    for (const entry of typed) {
      expect(segmentFor(entry.type!)).not.toBeNull();
    }
  });

  it("points every typed entry at its own list route", () => {
    for (const entry of typed) {
      expect(entryHref(entry)).toBe(`/compendium/${segmentFor(entry.type!)}`);
      expect(entryHref(entry)).toBe(listHrefFor(entry.type!));
    }
  });

  /**
   * A card with no type browses a slice of one — sidekicks are `class` rows —
   * so it cannot take its route from the route map and has to carry its own.
   * Nothing else can say whether that route exists, either.
   */
  it("gives a slice card a route of its own, under the compendium", () => {
    for (const entry of entries.filter((candidate) => !candidate.type)) {
      expect(entry.route).toMatch(/^\/compendium\/[a-z-]+$/);
      expect(typeof entry.ready).toBe("boolean");
    }
  });

  it("sends no two cards to the same place", () => {
    const routes = entries.map(entryHref);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

describe("entries are presentable", () => {
  it("gives every type a label and a blurb", () => {
    for (const entry of entries) {
      expect(entry.label.trim()).not.toBe("");
      expect(entry.blurb.trim()).not.toBe("");
    }
  });

  /**
   * Half these types are unrecognisable by name — "charoption", "boon",
   * "itemGroup" — so a blurb that just restates the label helps nobody.
   */
  it("does not simply restate the label", () => {
    for (const entry of entries) {
      expect(entry.blurb.toLowerCase()).not.toBe(entry.label.toLowerCase());
    }
  });

  it("keeps groups non-empty and uniquely identified", () => {
    const ids = DIRECTORY.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const group of DIRECTORY) {
      expect(group.entries.length).toBeGreaterThan(0);
      expect(group.label.trim()).not.toBe("");
    }
  });
});

describe("IMPLEMENTED", () => {
  /** Marking a type built when it is not turns the card into a 404. */
  it("only names types the directory lists", () => {
    const listed = new Set(entries.map((entry) => entry.type));
    for (const type of IMPLEMENTED) {
      expect(listed.has(type)).toBe(true);
    }
  });

  it("currently includes spells", () => {
    expect(IMPLEMENTED.has("spell")).toBe(true);
  });
});
