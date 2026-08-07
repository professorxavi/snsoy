import { describe, expect, it } from "vitest";
import { DIRECTORY, IMPLEMENTED } from "./compendium-directory";
import { BROWSABLE_TYPES, listHrefFor, segmentFor } from "./routes";

/**
 * The index and the route map have to agree.
 *
 * The failure this guards against is quiet: someone adds a browsable type, the
 * route works, and it is reachable only by typing the URL because nothing ever
 * pointed at it. A test is the only thing that notices.
 */

const entries = DIRECTORY.flatMap((group) => group.entries);

describe("the directory covers the route map", () => {
  it("lists every browsable type exactly once", () => {
    const listed = entries.map((entry) => entry.type).sort();
    expect(listed).toEqual([...BROWSABLE_TYPES].sort());
  });

  it("has no duplicates across groups", () => {
    const listed = entries.map((entry) => entry.type);
    expect(new Set(listed).size).toBe(listed.length);
  });

  /** Fragments render on a parent page, so they must never appear here. */
  it("omits types with no browse route of their own", () => {
    for (const entry of entries) {
      expect(segmentFor(entry.type)).not.toBeNull();
    }
  });

  it("points every entry at its own canonical list", () => {
    for (const entry of entries) {
      expect(listHrefFor(entry.type)).toBe(`/compendium/${segmentFor(entry.type)}`);
    }
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

  it("currently contains the spells slice", () => {
    expect(IMPLEMENTED.has("spell")).toBe(true);
  });
});
