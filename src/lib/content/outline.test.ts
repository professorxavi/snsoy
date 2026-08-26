import { describe, expect, it } from "vitest";
import { splitSections, uniqueAnchor } from "./outline";

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
