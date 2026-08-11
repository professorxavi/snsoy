import { describe, expect, it } from "vitest";
import {
  alignmentCode,
  alignmentLabel,
  deityAlignment,
  deityDomains,
  deitySubtitle,
} from "./deities";

describe("deityAlignment", () => {
  it("reads the codes from either shape the field arrives in", () => {
    expect(deityAlignment('["C", "G"]')).toBe("Chaotic Good");
    expect(deityAlignment(["L", "E"])).toBe("Lawful Evil");
  });

  it("reads a single-code alignment", () => {
    expect(deityAlignment(["N"])).toBe("Neutral");
  });

  /** 25 of the 494 have none, mostly the gods of dead pantheons. */
  it("prints an em dash where a god has no alignment", () => {
    expect(deityAlignment(null)).toBe("—");
    expect(deityAlignment([])).toBe("—");
  });
});

/**
 * The facet value and the rail label are the two halves of one bargain: the
 * code stays in the URL so a filtered link survives a change of wording, and
 * the words reach the reader. They have to round-trip.
 */
describe("the alignment facet value", () => {
  it("joins the codes in the order the god's own field has them", () => {
    expect(alignmentCode(["C", "G"])).toBe("CG");
    expect(alignmentCode(["N"])).toBe("N");
    expect(alignmentCode(null)).toBe("");
  });

  it("reads back as the words it stands for", () => {
    expect(alignmentLabel("CG")).toBe("Chaotic Good");
    expect(alignmentLabel(alignmentCode(["L", "E"]))).toBe("Lawful Evil");
  });
});

describe("deityDomains", () => {
  it("lists the domains", () => {
    expect(deityDomains('["Knowledge", "War"]')).toBe("Knowledge, War");
    expect(deityDomains(["Trickery"])).toBe("Trickery");
  });

  it("prints an em dash for a god whose followers get none", () => {
    expect(deityDomains(null)).toBe("—");
    expect(deityDomains([])).toBe("—");
  });
});

describe("deitySubtitle", () => {
  it("says what the god is god of, and whose god they are", () => {
    expect(
      deitySubtitle({ title: "God of luck and music", pantheon: "Egyptian" }),
    ).toBe("God of luck and music · Egyptian pantheon");
  });

  /** 131 of the 494 carry no title; every one of them has a pantheon. */
  it("falls back to the pantheon alone", () => {
    expect(deitySubtitle({ pantheon: "Dwarven" })).toBe("Dwarven pantheon");
  });
});
