import { describe, expect, it } from "vitest";
import {
  languageSummary,
  proficiencyLabel,
  proficiencySummary,
} from "./backgrounds";

describe("proficiencyLabel", () => {
  /** As the books set it: the joining word stays lowercase. */
  it("capitalises a stored skill name", () => {
    expect(proficiencyLabel("sleight of hand")).toBe("Sleight of Hand");
    expect(proficiencyLabel("animal handling")).toBe("Animal Handling");
    expect(proficiencyLabel("insight")).toBe("Insight");
  });

  /** Tool names carry punctuation the skills do not. */
  it("capitalises the first letter, not the first character", () => {
    expect(proficiencyLabel("thieves' tools")).toBe("Thieves' Tools");
    expect(proficiencyLabel("vehicles (land)")).toBe("Vehicles (Land)");
  });
});

describe("proficiencySummary", () => {
  it("joins a list", () => {
    expect(proficiencySummary(["insight", "religion"])).toBe("Insight, Religion");
  });

  /**
   * An em dash, not an empty cell: 26 backgrounds grant no tools, and a blank
   * there is indistinguishable from a column that failed to load.
   */
  it("prints an em dash for nothing", () => {
    expect(proficiencySummary([])).toBe("—");
    expect(proficiencySummary(null)).toBe("—");
  });
});

describe("languageSummary", () => {
  it("counts in words, as the books phrase it", () => {
    expect(languageSummary(1)).toBe("One of your choice");
    expect(languageSummary(2)).toBe("Two of your choice");
  });

  it("falls back to the number for a count nobody wrote a word for", () => {
    expect(languageSummary(9)).toBe("9 of your choice");
  });

  it("prints an em dash where a background grants none", () => {
    expect(languageSummary(null)).toBe("—");
    expect(languageSummary(0)).toBe("—");
  });
});
