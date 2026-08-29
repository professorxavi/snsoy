import { describe, expect, it } from "vitest";
import { chapterOutline, splitSections, uniqueAnchor } from "./outline";

/**
 * Shapes taken from real chapter and race bodies. The case that matters is a
 * repeated heading: several chapters name two sections the same thing, and two
 * sections sharing an anchor would send the outline to the wrong one.
 */

describe("splitSections", () => {
  it("collects prose before the first named entry as the intro", () => {
    const { intro, sections } = splitSections([
      "Opening paragraph.",
      { type: "section", name: "Gods of Theros", entries: ["Body."] },
    ]);

    expect(intro).toEqual(["Opening paragraph."]);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("Gods of Theros");
    expect(sections[0]?.entries).toEqual(["Body."]);
  });

  it("derives an anchor from the title", () => {
    const { sections } = splitSections([
      { type: "section", name: "Realms of Gods and Mortals" },
    ]);

    expect(sections[0]?.id).toBe("realms-of-gods-and-mortals");
  });

  /**
   * A top-level section is unwrapped before the renderer sees it, so its own id
   * would be lost here — and 713 `{@area}` tags in the books address one.
   */
  it("carries the entry's own id through, where it has one", () => {
    const { sections } = splitSections([
      { type: "section", id: "595", name: "Wilderness Encounters" },
      { type: "section", name: "Omu Encounters" },
    ]);

    expect(sections[0]?.anchorId).toBe("595");
    expect(sections[0]?.id).toBe("wilderness-encounters");
    expect(sections[1]?.anchorId).toBeUndefined();
  });

  /** Two sections with one anchor would make the outline ambiguous. */
  it("disambiguates repeated headings", () => {
    const { sections } = splitSections([
      { type: "section", name: "Treasure" },
      { type: "section", name: "Treasure" },
      { type: "section", name: "Treasure" },
    ]);

    expect(sections.map((s) => s.id)).toEqual([
      "treasure",
      "treasure-2",
      "treasure-3",
    ]);
  });

  /** An unnamed grouping is content, not structure. */
  it("treats an entry with a blank name as intro", () => {
    const { intro, sections } = splitSections([
      { type: "entries", name: "   ", entries: ["Body."] },
    ]);

    expect(sections).toHaveLength(0);
    expect(intro).toHaveLength(1);
  });

  it("trims whitespace off a title", () => {
    const { sections } = splitSections([{ type: "section", name: " Combat " }]);

    expect(sections[0]?.title).toBe("Combat");
    expect(sections[0]?.id).toBe("combat");
  });

  /** A heading with no body still belongs in the outline. */
  it("keeps a named entry that carries no entries", () => {
    const { sections } = splitSections([{ type: "section", name: "Credits" }]);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.entries).toEqual([]);
  });

  it("handles an absent body", () => {
    expect(splitSections(undefined)).toEqual({ intro: [], sections: [] });
  });
});

describe("uniqueAnchor", () => {
  it("strips punctuation and apostrophes", () => {
    expect(uniqueAnchor("Xanathar's Guide", new Set())).toBe("xanathars-guide");
  });

  /** Every character is punctuation in a few adventure headings. */
  it("falls back when nothing survives", () => {
    expect(uniqueAnchor("—", new Set())).toBe("section");
  });
});

describe("chapterOutline", () => {
  const chapter = (entries: unknown[]) =>
    chapterOutline(splitSections(entries).sections);

  it("lists two levels below a top-level section", () => {
    const { nodes } = chapter([
      {
        type: "section",
        id: "032",
        name: "Locations in the City",
        entries: [
          {
            type: "entries",
            id: "034",
            name: "Old City",
            entries: [
              { type: "entries", id: "035", name: "1. Beggars' Palaces" },
            ],
          },
        ],
      },
    ]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.title).toBe("Locations in the City");
    expect(nodes[0]?.children.map((c) => c.title)).toEqual(["Old City"]);
    expect(nodes[0]?.children[0]?.children.map((c) => c.title)).toEqual([
      "1. Beggars' Palaces",
    ]);
  });

  /** Deeper than that says nothing a reader could not find by then. */
  it("stops at the third level", () => {
    const { nodes } = chapter([
      {
        type: "section",
        name: "Things to Do",
        entries: [
          {
            type: "entries",
            name: "Dinosaur Racing",
            entries: [
              {
                type: "entries",
                name: "Betting",
                entries: [{ type: "entries", name: "Odds" }],
              },
            ],
          },
        ],
      },
    ]);

    const third = nodes[0]?.children[0]?.children[0];
    expect(third?.title).toBe("Betting");
    expect(third?.children).toEqual([]);
  });

  /**
   * A top-level section keeps the slug `splitSections` gave it — the page
   * already renders that anchor — while everything nested uses the id the
   * source data hangs on the entry, so an outline row and an `{@area}` link to
   * the same heading land on one element.
   */
  it("takes the top level's slug and the nested level's own id", () => {
    const { nodes } = chapter([
      {
        type: "section",
        id: "032",
        name: "Locations in the City",
        entries: [{ type: "entries", id: "034", name: "Old City" }],
      },
    ]);

    expect(nodes[0]?.id).toBe("locations-in-the-city");
    expect(nodes[0]?.children[0]?.id).toBe("034");
  });

  /** 219 of the 26,550 entries the outline reaches carry no id at all. */
  it("derives an anchor for a nested entry with no id", () => {
    const { nodes } = chapter([
      {
        type: "section",
        name: "City Denizens",
        entries: [{ type: "entries", name: "Merchant Princes" }],
      },
    ]);

    expect(nodes[0]?.children[0]?.id).toBe("merchant-princes");
  });

  it("keeps a derived anchor clear of the top level's slugs", () => {
    const { nodes } = chapter([
      { type: "section", name: "Treasure" },
      {
        type: "section",
        name: "Vault",
        entries: [{ type: "entries", name: "Treasure" }],
      },
    ]);

    expect(nodes[0]?.id).toBe("treasure");
    expect(nodes[1]?.children[0]?.id).toBe("treasure-2");
  });

  /**
   * A boxed sidebar carries a name and reads as a heading, but it is an aside
   * printed beside the text rather than a division of it.
   */
  it("leaves insets out", () => {
    const { nodes } = chapter([
      {
        type: "section",
        name: "Locations in the City",
        entries: [
          { type: "inset", id: "033", name: "Troubleshooting" },
          { type: "entries", id: "034", name: "Old City" },
        ],
      },
    ]);

    expect(nodes[0]?.children.map((c) => c.title)).toEqual(["Old City"]);
  });

  /** The renderer looks an entry up by identity to decide whether to mark it. */
  it("records each nested entry's anchor against the entry itself", () => {
    const ward = { type: "entries", id: "034", name: "Old City" };
    const section = {
      type: "section",
      name: "Locations in the City",
      entries: [ward],
    };
    const { anchors } = chapter([section]);

    expect(anchors.get(ward)).toBe("034");
    // The page splits the top level out and anchors it itself.
    expect(anchors.get(section)).toBeUndefined();
  });

  it("handles a chapter with no sections", () => {
    expect(chapter([]).nodes).toEqual([]);
  });

  /**
   * Storm King's Thunder lists 165 locations under one heading. Left whole
   * that is 165 rows in the gutter whether or not anyone is reading them.
   */
  describe("long lists", () => {
    const listing = (count: number, name: (n: number) => string) =>
      chapter([
        {
          type: "section",
          name: "Locations of the North",
          entries: Array.from({ length: count }, (_, index) => ({
            type: "entries",
            name: name(index),
          })),
        },
      ]).nodes[0];

    it("leaves a list short enough to read alone", () => {
      const section = listing(24, (n) => `Location ${n}`);

      expect(section?.children).toHaveLength(24);
      expect(section?.children[0]?.title).toBe("Location 0");
    });

    it("breaks a long one into runs named by the rows at either end", () => {
      // Alphabetical, like the two gazetteers this is really for.
      const places = [
        "Amphail",
        "Beliard",
        "Bryn Shander",
        "Calling Horns",
        "Daggerford",
        "Deadsnows",
        "Everlund",
        "Fireshear",
        "Gauntlgrym",
        "Glimmerwood",
        "Hundelstone",
        "Ironmaster",
        "Jalanthar",
        "Longsaddle",
        "Luskan",
        "Mirabar",
        "Mithral Hall",
        "Nesme",
        "Neverwinter",
        "Noanar's Hold",
        "Parnast",
        "Port Llast",
        "Rassalantar",
        "Ravenrock",
        "Red Larch",
        "Silverymoon",
        "Sundabar",
        "Triboar",
        "Waterdeep",
        "Yartar",
      ];
      const section = listing(places.length, (n) => places[n] as string);

      expect(section?.children).toHaveLength(3);
      expect(section?.children[0]?.title).toBe("Amphail – Glimmerwood");
      expect(section?.children[2]?.title).toBe("Parnast – Yartar");
    });

    /** A run names a stretch of the list; it is not a heading on the page. */
    it("gives a run no anchor of its own", () => {
      const run = listing(30, (n) => `Location ${n}`)?.children[0];

      expect(run?.id).toBeUndefined();
      expect(run?.key).toBe("locations-of-the-north~0");
    });

    it("keeps every row, in order, under the runs", () => {
      const section = listing(165, (n) => `Location ${n}`);
      const rows = section?.children.flatMap((run) => run.children) ?? [];

      expect(section?.children).toHaveLength(14);
      expect(rows).toHaveLength(165);
      expect(rows[0]?.title).toBe("Location 0");
      expect(rows[164]?.title).toBe("Location 164");
    });

    /** A final run of one would read as a mistake. */
    it("divides as evenly as it can", () => {
      const sizes = listing(50, (n) => `Location ${n}`)?.children.map(
        (run) => run.children.length,
      );

      expect(sizes).toEqual([10, 10, 10, 10, 10]);
    });

    /**
     * A dungeon key is known by its number — "6E. Treasury" is 6E on the map —
     * so that is what names the run. Most of the long lists here are numbered.
     */
    it("names a numbered run by its map keys", () => {
      const section = listing(30, (n) => `${n + 1}. Room ${n}`);

      expect(section?.children[0]?.title).toBe("1 – 10");
      expect(section?.children[2]?.title).toBe("21 – 30");
    });

    it("keeps a letter suffix on a map key", () => {
      const section = listing(30, (n) => `${n + 1}A. Room ${n}`);

      expect(section?.children[0]?.title).toBe("1A – 10A");
    });
  });
});
