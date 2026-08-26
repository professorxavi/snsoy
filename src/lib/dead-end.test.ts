import { describe, expect, it } from "vitest";
import { readDeadEnd } from "./dead-end";
import { BROWSABLE_TYPES, hasDetailPage, hrefFor, segmentFor } from "./routes";

/**
 * The 404 page's one piece of intelligence.
 *
 * What it has to get right is the pairing: every URL `hrefFor` can produce for a
 * type with no page must be readable back into something the page can say, and
 * nothing else may be — including the types that do have a page, where a 404 is
 * an ordinary typo and a signpost would be a confident lie.
 */

describe("readDeadEnd", () => {
  it("names the type and where it opens", () => {
    expect(readDeadEnd("/compendium/conditions/phb/prone")).toEqual({
      label: "Conditions",
      listHref: "/compendium/conditions",
    });
  });

  /**
   * The collision this file was parked on. Four types have a page, so a 404 on
   * one of them means a bad slug — and "Spells have no page of their own. They
   * open in a panel beside their list" is false in both halves. Races, classes
   * and creatures are worse still: reading pages with no aside at all.
   */
  describe("says nothing for a type that has a page", () => {
    it.each([
      ["a spell", "/compendium/spells/phb/frebal"],
      ["a race", "/compendium/races/phb/dwrf"],
      ["a class", "/compendium/classes/phb/figher"],
      ["a creature", "/compendium/monsters/mm/gobln"],
    ])("%s", (_case, path) => {
      expect(readDeadEnd(path)).toBeNull();
    });
  });

  it("title-cases a two-word segment", () => {
    expect(readDeadEnd("/compendium/variant-rules/dmg/madness")?.label).toBe(
      "Variant Rules",
    );
  });

  /** A type with a browse view is sent to it. */
  it("points a listed type at its list", () => {
    expect(readDeadEnd("/compendium/conditions/phb/prone")?.listHref).toBe(
      "/compendium/conditions",
    );
  });

  /**
   * A type with no browse view has nowhere to be sent, and must say so rather
   * than link to a route that 404s in its own right. Traps are here because
   * they used to be the other case: a list with no card, kept on the theory
   * that a hidden route was worth having. It was not, and the list is gone.
   */
  it.each([
    ["a type that never had a view", "/compendium/cards/cos/abjurer", "Cards"],
    ["one whose view was cut", "/compendium/traps/dmg/pit", "Traps"],
  ])("gives no list for %s", (_case, path, label) => {
    expect(readDeadEnd(path)).toEqual({ label, listHref: null });
  });

  /**
   * The whole point. Every address the app can generate has to come back as
   * something the page can name — a URL we emit and then cannot explain is the
   * failure this guards against.
   */
  it("reads back every URL hrefFor can produce for a page-less type", () => {
    const pageless = BROWSABLE_TYPES.filter((type) => !hasDetailPage(type));
    expect(pageless.length).toBe(BROWSABLE_TYPES.length - 4);

    for (const type of pageless) {
      const href = hrefFor({ entityType: type, sourceId: "PHB", slug: "x" })!;
      const read = readDeadEnd(href);

      expect(read, href).not.toBeNull();
      expect(read!.label.toLowerCase().replace(/ /g, "-")).toBe(
        segmentFor(type),
      );
    }
  });

  describe("says nothing about", () => {
    it.each([
      ["a list URL", "/compendium/conditions"],
      ["the index", "/compendium"],
      ["an unknown segment", "/compendium/goblins/mm/goblin"],
      ["a chapter", "/sources/phb/spellcasting"],
      ["the home page", "/"],
      ["a made-up path", "/nonsense/deeper/still/again"],
    ])("%s", (_case, path) => {
      expect(readDeadEnd(path)).toBeNull();
    });
  });
});
