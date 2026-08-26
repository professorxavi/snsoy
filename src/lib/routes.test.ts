import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BROWSABLE_TYPES,
  chapterHref,
  hasDetailPage,
  hrefFor,
  listHrefFor,
  parseEntityHref,
  segmentFor,
  sourceHref,
  typeForSegment,
} from "./routes";

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
  it("builds the compendium URL with a lowercased source", () => {
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

  /** A PHB dwarf has an MTF subrace, so the two sources need not match. */
  it("uses the parent's source for the path and the fragment's for the anchor", () => {
    expect(
      hrefFor(
        { entityType: "subrace", sourceId: "MTF", slug: "duergar" },
        { entityType: "race", sourceId: "PHB", slug: "dwarf" },
      ),
    ).toBe("/compendium/races/phb/dwarf#duergar");
  });

  /** A subclass is printed on its class's page, and addressed there. */
  it("addresses a subclass on the page of the class that owns it", () => {
    expect(
      hrefFor(
        { entityType: "subclass", sourceId: "TCE", slug: "bladesinging" },
        { entityType: "class", sourceId: "PHB", slug: "wizard" },
      ),
    ).toBe("/compendium/classes/phb/wizard#bladesinging");
  });

  /**
   * A subclass feature's parent is a subclass, which is itself a fragment and
   * has no page to anchor against. Unaddressable is the honest answer — it was
   * previously a link to a route that does not exist.
   */
  it("declines to address a fragment whose parent is one too", () => {
    expect(
      hrefFor(
        { entityType: "subclassFeature", sourceId: "TCE", slug: "song-of-defense" },
        { entityType: "subclass", sourceId: "TCE", slug: "bladesinging" },
      ),
    ).toBeNull();
  });

  it("declines to address a fragment with no parent, rather than guessing", () => {
    expect(
      hrefFor({ entityType: "classFeature", sourceId: "PHB", slug: "rage" }),
    ).toBeNull();
  });

  it("declines types that are never browsable entities", () => {
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

describe("sourceHref and chapterHref", () => {
  it("lowercases the source segment", () => {
    expect(sourceHref("PHB")).toBe("/sources/phb");
    expect(chapterHref("TftYP-ToH", "credits")).toBe(
      "/sources/tftyp-toh/credits",
    );
  });

  /**
   * The chapter segment is the slug, never the ordinal. Ordinals restart when a
   * source carries a second body, so MOT would have two chapter "0"s.
   */
  it("addresses a chapter by slug", () => {
    expect(chapterHref("MOT", "credits-2")).toBe("/sources/mot/credits-2");
  });

  /** Whatever `hrefFor` emits for a section must be what the reader serves. */
  it("agrees with hrefFor for a book section", () => {
    expect(
      hrefFor({
        entityType: "bookSection",
        sourceId: "DMG",
        slug: "creating-a-multiverse",
      }),
    ).toBe(chapterHref("DMG", "creating-a-multiverse"));
  });
});

/**
 * Book text is rendered as ordinary anchors, so opening one in place means
 * recovering the entity from its href. The pair has to agree in both
 * directions, and anything that is not an entity URL has to be refused rather
 * than guessed at — a wrong answer here opens the wrong thing.
 */
describe("parseEntityHref", () => {
  it("reads back what hrefFor wrote", () => {
    const entity = {
      entityType: "spell" as const,
      sourceId: "PHB",
      slug: "fireball",
    };

    expect(parseEntityHref(hrefFor(entity)!)).toEqual({
      type: "spell",
      sourceId: "phb",
      slug: "fireball",
    });
  });

  it("round-trips every browsable type", () => {
    for (const type of BROWSABLE_TYPES) {
      const href = hrefFor({ entityType: type, sourceId: "XGE", slug: "x" })!;
      expect(parseEntityHref(href)).toEqual({
        type,
        sourceId: "xge",
        slug: "x",
      });
    }
  });

  /** A subclass link addresses its class's page; the class is what opens. */
  it("drops a fragment rather than refusing the URL", () => {
    expect(parseEntityHref("/compendium/classes/phb/wizard#evocation")).toEqual({
      type: "class",
      sourceId: "phb",
      slug: "wizard",
    });
  });

  it("refuses anything that is not one entity's URL", () => {
    for (const href of [
      "/sources/phb/classes", // a chapter, not an entity
      "/compendium/spells", // the list
      "/compendium/spells/phb", // no slug
      "/compendium/spells/phb/fireball/extra", // too deep
      "/compendium/nonsense/phb/x", // unknown segment
      "/", // not the compendium at all
      "https://example.com/compendium/spells/phb/fireball", // off site
    ]) {
      expect(parseEntityHref(href), href).toBeNull();
    }
  });
});

/**
 * `TYPES_WITH_A_PAGE` is hand-listed because `readDeadEnd` runs in a client
 * component and cannot read the filesystem. This is the test that makes the
 * hand-listing safe: it reads the routes that actually exist and requires the
 * two to agree.
 *
 * The failure it exists for is silent. Add a detail route and forget the list,
 * and a mistyped slug on the new type gets told its type "has no page of its
 * own" — confidently, and wrongly. Delete one and every real dead end on that
 * type loses its signpost. Neither shows up anywhere else.
 */
describe("hasDetailPage", () => {
  const COMPENDIUM = join(process.cwd(), "src", "app", "compendium");

  /** Segments with a `[source]/[slug]/page.tsx` under them, read off disk. */
  const segmentsOnDisk = () =>
    readdirSync(COMPENDIUM, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) =>
        existsSync(join(COMPENDIUM, name, "[source]", "[slug]", "page.tsx")),
      )
      .sort();

  it("names exactly the types whose route exists on disk", () => {
    const declared = BROWSABLE_TYPES.filter(hasDetailPage)
      .map((type) => segmentFor(type)!)
      .sort();

    expect(declared).toEqual(segmentsOnDisk());
  });

  /**
   * Stated separately so the diff above stays readable when it breaks, and
   * because "four" is the claim `dead-end.test.ts` counts against.
   */
  it("is the exception rather than the rule", () => {
    const withPage = BROWSABLE_TYPES.filter(hasDetailPage);

    expect(withPage.sort()).toEqual(["class", "monster", "race", "spell"]);
    expect(BROWSABLE_TYPES.length - withPage.length).toBe(27);
  });
});
