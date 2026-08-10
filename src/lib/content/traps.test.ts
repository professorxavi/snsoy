import { describe, expect, it } from "vitest";
import { trapKindLabel, trapThreat } from "./traps";

/**
 * Both formatters are called from two places with two different shapes — a
 * table cell gets the JSON text `listGeneric`'s field map produced, the aside
 * gets the parsed blob — so each is checked both ways. A change that handled
 * only one would leave either every cell or every subtitle wrong, with nothing
 * else failing.
 */

describe("trapKindLabel", () => {
  it("names a trap or hazard code", () => {
    expect(trapKindLabel("SMPL")).toBe("Simple trap");
    expect(trapKindLabel("HAUNT")).toBe("Haunting");
    expect(trapKindLabel("EST")).toBe("Eldritch storm");
    expect(trapKindLabel("WTH")).toBe("Weather");
  });

  /**
   * Seven hazards carry no kind — the moulds, the slimes, Webs, Rot Grub. An em
   * dash is the honest cell; a name would be one the book never wrote.
   */
  it("prints an em dash where the data names no kind", () => {
    expect(trapKindLabel(null)).toBe("—");
    expect(trapKindLabel("")).toBe("—");
  });

  it("passes an unknown code through rather than blanking the row", () => {
    expect(trapKindLabel("ZZ")).toBe("ZZ");
  });
});

describe("trapThreat", () => {
  it("reads the rating from a list row's JSON text", () => {
    expect(trapThreat('[{"tier": 1, "threat": "dangerous"}]')).toBe(
      "Dangerous (tier 1)",
    );
  });

  it("reads the same rating from the parsed blob", () => {
    expect(trapThreat([{ tier: 2, threat: "deadly" }])).toBe("Deadly (tier 2)");
  });

  /** A trap rated for two tiers names both, rather than picking one. */
  it("names every tier a trap was rated for", () => {
    expect(
      trapThreat([
        { tier: 1, threat: "setback" },
        { tier: 2, threat: "dangerous" },
      ]),
    ).toBe("Setback (tier 1), Dangerous (tier 2)");
  });

  it("holds up where half the rating is missing", () => {
    expect(trapThreat([{ tier: 3 }])).toBe("tier 3");
    expect(trapThreat([{ threat: "deadly" }])).toBe("Deadly");
  });

  /** 12 of the 29 traps carry no rating at all. */
  it("prints an em dash for no rating", () => {
    expect(trapThreat(null)).toBe("—");
    expect(trapThreat([])).toBe("—");
  });
});
