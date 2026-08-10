import { describe, expect, it } from "vitest";
import { objectSize, objectStat, objectSummary } from "./objects";

describe("objectSize", () => {
  it("names a size from either shape the field arrives in", () => {
    expect(objectSize('["L"]')).toBe("Large");
    expect(objectSize(["L"])).toBe("Large");
  });

  /** The three eldritch cannons span two sizes, as 56 creatures do. */
  it("names both sizes where an object spans two", () => {
    expect(objectSize('["T", "S"]')).toBe("Tiny or Small");
  });

  /** The generic object entry stands for every object nobody wrote down. */
  it("reads the varying size as a word rather than as its code", () => {
    expect(objectSize('["V"]')).toBe("Varies");
  });

  it("prints an em dash where there is no size", () => {
    expect(objectSize(null)).toBe("—");
    expect(objectSize("")).toBe("—");
  });
});

describe("objectStat", () => {
  it("reads a number from a list row's text or from the blob", () => {
    expect(objectStat("18")).toBe("18");
    expect(objectStat(18)).toBe("18");
  });

  /**
   * An eldritch cannon's hit points are a sentence about your artificer level.
   * The panel prints it; a table cell has no room, so it says "Varies" and the
   * reader opens the object to find out what it varies with.
   */
  it("prints a special value in full, and shortens it for a cell", () => {
    const hp = '{"special": "equal to five times your artificer level"}';

    expect(objectStat(hp)).toBe("equal to five times your artificer level");
    expect(objectStat(hp, { short: true })).toBe("Varies");
  });

  it("prints an em dash for nothing at all", () => {
    expect(objectStat(null)).toBe("—");
    expect(objectStat({}, { short: true })).toBe("—");
  });
});

describe("objectSummary", () => {
  it("states what a party wants before it starts hitting something", () => {
    expect(objectSummary({ size: ["L"], ac: 17, hp: 50 })).toBe(
      "Large object · AC 17 · 50 hp",
    );
  });

  /** The generic object entry gives neither as a number, and says so. */
  it("shortens a stat the books left as a sentence", () => {
    expect(
      objectSummary({
        size: ["M"],
        ac: { special: "Varies (see below)" },
        hp: { special: "Varies (see below)" },
      }),
    ).toBe("Medium object · AC Varies · Varies hp");
  });
});
