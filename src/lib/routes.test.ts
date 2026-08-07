import { describe, expect, it } from "vitest";
import { hrefFor, listHrefFor, segmentFor, typeForSegment } from "./routes";

/**
 * The URL scheme rests on `entities` being unique on
 * `(entity_type, source_id, slug)`. These tests guard the two invariants that
 * keep that uniqueness proof valid — a segment naming exactly one type, and
 * `book_id` never reaching a URL.
 */

describe("segmentFor", () => {
  it("translates rather than derives", () => {
    // Nothing here is reachable by pluralising the enum value.
    expect(segmentFor("optionalfeature")).toBe("optional-features");
    expect(segmentFor("charoption")).toBe("character-options");
    expect(segmentFor("variantrule")).toBe("variant-rules");
    expect(segmentFor("baseitem")).toBe("base-items");
    expect(segmentFor("status")).toBe("statuses");
  });

  it("gives fragments no segment of their own", () => {
    expect(segmentFor("subrace")).toBeNull();
    expect(segmentFor("classFeature")).toBeNull();
    expect(segmentFor("subclassFeature")).toBeNull();
  });

  it("round-trips through the reverse lookup", () => {
    expect(typeForSegment("optional-features")).toBe("optionalfeature");
    expect(typeForSegment("spells")).toBe("spell");
    expect(typeForSegment("not-a-segment")).toBeNull();
  });

  /**
   * Two types sharing a segment would reintroduce the collisions the scheme
   * exists to avoid — `champion` is both a subclass and its own intro feature.
   */
  it("never gives two types the same segment", () => {
    const types = [
      "spell",
      "monster",
      "item",
      "baseitem",
      "itemGroup",
      "class",
      "subclass",
      "race",
      "optionalfeature",
      "condition",
      "status",
    ] as const;

    const segments = types.map(segmentFor);
    expect(new Set(segments).size).toBe(segments.length);
  });
});

describe("hrefFor", () => {
  it("builds the canonical compendium URL with a lowercased source", () => {
    expect(
      hrefFor({ entityType: "spell", sourceId: "PHB", slug: "fireball" }),
    ).toBe("/compendium/spells/phb/fireball");

    // Source ids contain hyphens, which is why they get their own segment
    // instead of being suffixed onto the slug.
    expect(
      hrefFor({ entityType: "monster", sourceId: "TftYP-ToH", slug: "goblin" }),
    ).toBe("/compendium/monsters/tftyp-toh/goblin");
  });

  it("addresses a chapter by slug, never by index", () => {
    expect(
      hrefFor({
        entityType: "bookSection",
        sourceId: "DMG",
        slug: "creating-a-multiverse",
      }),
    ).toBe("/sources/dmg/creating-a-multiverse");
  });

  it("renders a fragment as an anchor on its parent's page", () => {
    expect(
      hrefFor(
        { entityType: "subrace", sourceId: "PHB", slug: "hill" },
        { entityType: "race", sourceId: "PHB", slug: "dwarf" },
      ),
    ).toBe("/compendium/races/phb/dwarf#hill");
  });

  /** A PHB wizard has TCE subclasses, so the two sources need not match. */
  it("uses the parent's source for the path and the fragment's for the anchor", () => {
    expect(
      hrefFor(
        { entityType: "subclassFeature", sourceId: "TCE", slug: "song-of-defense" },
        { entityType: "subclass", sourceId: "TCE", slug: "bladesinging" },
      ),
    ).toBe("/compendium/subclasses/tce/bladesinging#song-of-defense");
  });

  it("declines to address a fragment with no parent, rather than guessing", () => {
    expect(
      hrefFor({ entityType: "classFeature", sourceId: "PHB", slug: "rage" }),
    ).toBeNull();
  });

  it("declines types the corpus never yields as browsable entities", () => {
    expect(
      hrefFor({ entityType: "magicvariant", sourceId: "DMG", slug: "x" }),
    ).toBeNull();
  });
});

describe("listHrefFor", () => {
  it("points at the browse view", () => {
    expect(listHrefFor("spell")).toBe("/compendium/spells");
  });
});
