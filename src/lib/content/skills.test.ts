import { describe, expect, it } from "vitest";
import { abilityLabel, checkName, skillCovers } from "./skills";

/**
 * The skill formatters.
 *
 * Two of these turn a three-letter code into the words a reader expects, and
 * the third is our own summary line. What is worth pinning is the fallback in
 * each: the data is a JSON blob with no schema behind it, so an absent ability
 * has to produce a cell rather than "null".
 */

describe("abilityLabel", () => {
  it("spells the abbreviation out", () => {
    expect(abilityLabel("wis")).toBe("Wisdom");
    expect(abilityLabel("cha")).toBe("Charisma");
  });

  it("holds the column open when the data has no ability", () => {
    expect(abilityLabel(null)).toBe("—");
    expect(abilityLabel(undefined)).toBe("—");
  });
});

describe("checkName", () => {
  /** The form every rules sentence in the books uses. */
  it("names the check the way the books do", () => {
    expect(checkName("wis", "Perception")).toBe("Wisdom (Perception)");
  });

  /** An empty pair of brackets says less than the name alone. */
  it("falls back to the skill's name when no ability is given", () => {
    expect(checkName(null, "Perception")).toBe("Perception");
  });
});

describe("skillCovers", () => {
  it("summarises a skill in a line", () => {
    expect(skillCovers("stealth")).toBe("Hiding, sneaking and slipping past unseen.");
  });

  /** Null, not "", so the cell is left empty rather than filled with nothing. */
  it("is null for anything unsummarised", () => {
    expect(skillCovers("no-such-skill")).toBeNull();
  });

  /**
   * These sit in a table cell that does not wrap, beside three other columns.
   * A line that grew into a paragraph would push the table into a horizontal
   * scroll on every screen, which is invisible in a diff and obvious on the
   * page.
   *
   * The seeded skills are checked against this map in the smoke test; here the
   * shape is checked without needing a database.
   */
  it("keeps every summary to one short sentence", () => {
    const slugs = ["acrobatics", "animal-handling", "sleight-of-hand", "survival"];

    for (const slug of slugs) {
      const line = skillCovers(slug)!;
      expect(line.length).toBeLessThanOrEqual(52);
      expect(line).toMatch(/^[A-Z][^.]*\.$/);
    }
  });
});
