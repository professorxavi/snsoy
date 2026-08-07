import { describe, expect, it } from "vitest";
import {
  componentLetters,
  formatCastingTime,
  formatClassList,
  formatComponents,
  formatDuration,
  formatRange,
  levelLabel,
  schoolName,
  spellSubtitle,
} from "./spells";

/**
 * The inputs here are verbatim corpus shapes. Every formatter was also swept
 * over all 525 loaded spells and its distinct outputs read through — 33 ranges,
 * 28 durations, 10 casting times, 6 component combinations — which is how the
 * "150 foots" case below was found.
 */

describe("spellSubtitle", () => {
  it("inverts for cantrips, as the books print it", () => {
    expect(spellSubtitle(3, "V")).toBe("3rd-level evocation");
    expect(spellSubtitle(0, "T")).toBe("Transmutation cantrip");
  });

  it("ordinalises correctly across the whole spell range", () => {
    expect(levelLabel(0)).toBe("Cantrip");
    expect(levelLabel(1)).toBe("1st-level");
    expect(levelLabel(2)).toBe("2nd-level");
    expect(levelLabel(3)).toBe("3rd-level");
    expect(levelLabel(9)).toBe("9th-level");
  });

  it("expands the single-letter school code", () => {
    // Evocation is "V", not "E" — "E" is Enchantment.
    expect(schoolName("V")).toBe("Evocation");
    expect(schoolName("E")).toBe("Enchantment");
  });
});

describe("formatRange", () => {
  /** The regression: a generic pluraliser turns 150 feet into "150 foots". */
  it("pluralises feet irregularly", () => {
    expect(
      formatRange({ type: "point", distance: { type: "feet", amount: 150 } }),
    ).toBe("150 feet");
    expect(
      formatRange({ type: "point", distance: { type: "feet", amount: 1 } }),
    ).toBe("1 foot");
  });

  it("groups thousands", () => {
    expect(
      formatRange({ type: "point", distance: { type: "feet", amount: 1000 } }),
    ).toBe("1,000 feet");
  });

  it("names the ranges that are not measurements", () => {
    expect(formatRange({ type: "point", distance: { type: "self" } })).toBe("Self");
    expect(formatRange({ type: "point", distance: { type: "touch" } })).toBe("Touch");
    expect(formatRange({ type: "point", distance: { type: "sight" } })).toBe("Sight");
    expect(formatRange({ type: "point", distance: { type: "unlimited" } })).toBe(
      "Unlimited",
    );
  });

  /**
   * The case the typed columns cannot express at all: `range_feet` holds 30 for
   * both "30 feet" and "Self (30-foot cone)", which are very different places
   * to be standing.
   */
  it("distinguishes an area from a distance", () => {
    expect(
      formatRange({ type: "cone", distance: { type: "feet", amount: 30 } }),
    ).toBe("Self (30-foot cone)");
    expect(
      formatRange({ type: "radius", distance: { type: "miles", amount: 5 } }),
    ).toBe("Self (5-mile radius)");
  });

  it("degrades rather than throwing on a missing range", () => {
    expect(formatRange(null)).toBe("—");
    expect(formatRange({ type: "point" })).toBe("—");
  });
});

describe("formatDuration", () => {
  it("prefixes concentration and subsumes 'up to' into it", () => {
    expect(
      formatDuration([
        { type: "timed", duration: { type: "minute", amount: 1 }, concentration: true },
      ]),
    ).toBe("Concentration, up to 1 minute");
  });

  it("keeps 'up to' when there is no concentration", () => {
    expect(
      formatDuration([
        { type: "timed", duration: { type: "hour", amount: 8, upTo: true } },
      ]),
    ).toBe("Up to 8 hours");
  });

  it("reads the ends of a permanent effect", () => {
    expect(formatDuration([{ type: "permanent", ends: ["dispel"] }])).toBe(
      "Until dispelled",
    );
    expect(
      formatDuration([{ type: "permanent", ends: ["dispel", "trigger"] }]),
    ).toBe("Until dispelled or triggered");
  });

  it("joins the spells that offer two durations", () => {
    expect(
      formatDuration([
        { type: "instant" },
        { type: "timed", duration: { type: "hour", amount: 1 } },
      ]),
    ).toBe("Instantaneous or 1 hour");
  });
});

describe("formatCastingTime", () => {
  it("expands the terse action economy", () => {
    expect(formatCastingTime([{ number: 1, unit: "action" }])).toBe("1 action");
    expect(formatCastingTime([{ number: 1, unit: "bonus" }])).toBe("1 bonus action");
  });

  it("pluralises durations but not actions", () => {
    expect(formatCastingTime([{ number: 10, unit: "minute" }])).toBe("10 minutes");
    expect(formatCastingTime([{ number: 1, unit: "minute" }])).toBe("1 minute");
  });

  /** "1 reaction" alone does not tell you when you may cast the spell. */
  it("carries a reaction's trigger when asked for it", () => {
    const time = [
      {
        number: 1,
        unit: "reaction",
        condition: "which you take when you are damaged",
      },
    ];
    expect(formatCastingTime(time)).toBe("1 reaction");
    expect(formatCastingTime(time, { withCondition: true })).toBe(
      "1 reaction, which you take when you are damaged",
    );
  });
});

describe("formatComponents", () => {
  it("appends the material component's text", () => {
    expect(
      formatComponents({
        v: true,
        s: true,
        m: "a tiny ball of bat guano and sulfur",
      }),
    ).toBe("V, S, M (a tiny ball of bat guano and sulfur)");
  });

  /** Materials with a gp cost arrive as an object rather than a string. */
  it("reads the text out of a costed material", () => {
    expect(
      formatComponents({
        v: true,
        s: true,
        m: { text: "incense worth at least 250 gp", cost: 25000, consume: true },
      }),
    ).toBe("V, S, M (incense worth at least 250 gp)");
  });

  it("gives a table cell just the letters", () => {
    expect(componentLetters({ v: true, s: true, m: "a bit of fleece" })).toBe(
      "V, S, M",
    );
    expect(componentLetters({ s: true })).toBe("S");
  });
});

describe("formatClassList", () => {
  it("capitalises the corpus's lowercased class names and sorts them", () => {
    expect(formatClassList(["wizard", "sorcerer", "artificer"])).toBe(
      "Artificer, Sorcerer, Wizard",
    );
  });

  it("has something to say when there are none", () => {
    expect(formatClassList([])).toBe("—");
    expect(formatClassList(null)).toBe("—");
  });
});
