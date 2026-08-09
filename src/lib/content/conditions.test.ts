import { describe, expect, it } from "vitest";
import { conditionEffect } from "./conditions";

/**
 * The effect lines the condition list prints.
 *
 * These are ours rather than the book's, so nothing else can check them. What
 * is worth pinning is the shape: they sit in a table cell beside the name, and
 * a line that grew into a sentence about weight and ageing — which is how
 * Petrified actually opens — would stop the column being scannable at all.
 */

describe("conditionEffect", () => {
  it("says what the condition does to you", () => {
    expect(conditionEffect("poisoned")).toBe(
      "Disadvantage on attack rolls and ability checks.",
    );
  });

  /** Null, not "", so the cell is left empty rather than filled with nothing. */
  it("is null for anything unsummarised", () => {
    expect(conditionEffect("no-such-condition")).toBeNull();
  });

  it("keeps every summary to one short sentence", () => {
    const slugs = ["blinded", "exhaustion", "petrified", "unconscious"];

    for (const slug of slugs) {
      const line = conditionEffect(slug)!;
      expect(line.length).toBeLessThanOrEqual(52);
      expect(line).toMatch(/^[A-Z][^.]*\.$/);
    }
  });
});
