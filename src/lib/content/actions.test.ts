import { describe, expect, it } from "vitest";
import { actionTime } from "./actions";

/**
 * The `time` array, read back into words.
 *
 * Worth its own test because the input is JSON text rather than a value — the
 * list projection can only hand over `data->>'time'` — so every shape the books
 * put in that array has to survive a round trip through the parser.
 */

describe("actionTime", () => {
  it("names the unit rather than the code the data stores", () => {
    expect(actionTime('[{"unit": "action", "number": 1}]')).toBe("Action");
    expect(actionTime('[{"unit": "bonus", "number": 1}]')).toBe("Bonus Action");
    expect(actionTime('[{"unit": "reaction", "number": 1}]')).toBe("Reaction");
  });

  /**
   * Identify a Spell and Overrun both carry two, and the whole answer is the
   * choice — an action that says only "Reaction" has lost half its rule.
   */
  it("joins two costs the way the books write a choice", () => {
    expect(
      actionTime('[{"unit": "reaction", "number": 1}, {"unit": "action", "number": 1}]'),
    ).toBe("Reaction or Action");
  });

  /** Some entries are a bare word the book wrote itself. */
  it("passes through a plain string unchanged", () => {
    expect(actionTime('["Varies"]')).toBe("Varies");
    expect(actionTime('["Free"]')).toBe("Free");
  });

  /** Mark carries no `time` at all, and the cell is left empty rather than wrong. */
  it("has nothing to say when the data carries no time", () => {
    expect(actionTime(null)).toBeNull();
    expect(actionTime(undefined)).toBeNull();
  });

  /** A unit nobody has taught it prints the code rather than an empty cell. */
  it("falls back to the raw unit it was given", () => {
    expect(actionTime('[{"unit": "minute", "number": 10}]')).toBe("minute");
  });
});
