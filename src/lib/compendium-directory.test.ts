import { describe, expect, it } from "vitest";
import {
  DIRECTORY,
  entryHref,
  IMPLEMENTED,
  WITHOUT_A_CARD,
} from "./compendium-directory";
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
  /**
   * Every browsable type but the declared exceptions, and each exactly once.
   * Naming the exceptions in a set rather than leaving a hole is what keeps the
   * agreement provable: a type dropped from the index has to be dropped on
   * purpose, in writing.
   */
  it("lists every browsable type exactly once", () => {
    const listed = typed.map((entry) => entry.type).sort();
    const expected = BROWSABLE_TYPES.filter(
      (type) => !WITHOUT_A_CARD.has(type),
    ).sort();

    expect(listed).toEqual(expected);
  });

  /** A type with no card must still be addressable, or its links go nowhere. */
  it("keeps a segment for a type it does not list", () => {
    for (const type of WITHOUT_A_CARD) {
      expect(segmentFor(type)).not.toBeNull();
      expect(typed.map((entry) => entry.type)).not.toContain(type);
    }
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

  /** The default, and what every typed card does now. */
  it("points a typed entry at its own list route unless it names another", () => {
    for (const entry of typed.filter((candidate) => !candidate.route)) {
      expect(entryHref(entry)).toBe(`/compendium/${segmentFor(entry.type!)}`);
      expect(entryHref(entry)).toBe(listHrefFor(entry.type!));
    }
  });

  /**
   * One kind of card carries its own route: one that browses a slice of a type
   * — sidekicks are `class` rows. It cannot take its route from the route map,
   * and it cannot let `IMPLEMENTED` answer for whether that route exists,
   * because `IMPLEMENTED` answers for a type's own list and this is not one.
   *
   * There used to be a second kind — a type whose card pointed at a list it
   * shared, as `baseitem` and `itemGroup` pointed at `/compendium/items` with a
   * category set. Both are in `WITHOUT_A_CARD` now, so a typed card with its
   * own route no longer exists; the shape is still allowed and still checked.
   */
  it("keeps a card's own route under the compendium, and says if it is live", () => {
    for (const entry of entries.filter((candidate) => candidate.route)) {
      // A query string is allowed: a shared list is reached with its filter set.
      expect(entry.route).toMatch(/^\/compendium\/[a-z-]+(\?[\w=&]+)?$/);
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
