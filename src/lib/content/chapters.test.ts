import { describe, expect, it } from "vitest";
import { chapterLabel, groupByBook, neighbours } from "./chapters";

/**
 * The cases are drawn from the two sources that actually exercise the rules:
 * PHB, which is one body with numbered chapters, appendices and unnumbered
 * front matter; and MOT, whose second body restarts the ordinal count.
 */

const mot = [
  { bookId: "MOT", slug: "welcome-to-theros" },
  { bookId: "MOT", slug: "credits" },
  { bookId: "MOT-NSS", slug: "no-silent-secret" },
  { bookId: "MOT-NSS", slug: "credits-2" },
];

describe("groupByBook", () => {
  it("returns one body for an ordinary source", () => {
    const chapters = [
      { bookId: "PHB", slug: "introduction" },
      { bookId: "PHB", slug: "combat" },
    ];

    expect(groupByBook(chapters, "PHB")).toEqual([
      { bookId: "PHB", chapters },
    ]);
  });

  it("splits an inner work into its own body", () => {
    expect(groupByBook(mot, "MOT")).toEqual([
      { bookId: "MOT", chapters: mot.slice(0, 2) },
      { bookId: "MOT-NSS", chapters: mot.slice(2) },
    ]);
  });

  /**
   * The rows arrive ordered by `book_id`, so an inner work whose id sorts first
   * would otherwise print above the book that contains it.
   */
  it("puts the source's own body first however the rows arrived", () => {
    const inverted = [...mot.slice(2), ...mot.slice(0, 2)];

    expect(groupByBook(inverted, "MOT").map((body) => body.bookId)).toEqual([
      "MOT",
      "MOT-NSS",
    ]);
  });

  it("keeps a body whose id never matches the source", () => {
    const orphan = [{ bookId: "MOT-NSS", slug: "no-silent-secret" }];

    expect(groupByBook(orphan, "MOT")).toEqual([
      { bookId: "MOT-NSS", chapters: orphan },
    ]);
  });

  it("has no bodies for a source with no chapters", () => {
    expect(groupByBook([], "TftYP")).toEqual([]);
  });
});

describe("chapterLabel", () => {
  it("names the ordinal's own kind", () => {
    expect(chapterLabel({ ordinalType: "chapter", ordinalLabel: "9" })).toBe(
      "Chapter 9",
    );
    expect(chapterLabel({ ordinalType: "appendix", ordinalLabel: "B" })).toBe(
      "Appendix B",
    );
    expect(chapterLabel({ ordinalType: "part", ordinalLabel: "1" })).toBe(
      "Part 1",
    );
  });

  it("assumes a chapter when the kind is missing", () => {
    expect(chapterLabel({ ordinalType: null, ordinalLabel: "3" })).toBe(
      "Chapter 3",
    );
  });

  /** Introductions and credits print with no number, so they get no label. */
  it("is null without an ordinal", () => {
    expect(
      chapterLabel({ ordinalType: "chapter", ordinalLabel: null }),
    ).toBeNull();
  });
});

describe("neighbours", () => {
  it("offers both directions in the middle of a book", () => {
    expect(neighbours(mot, "credits")).toEqual({
      previous: mot[0],
      next: mot[2],
    });
  });

  /**
   * The seam: MOT's last chapter steps forward into MOT-NSS, and NSS's first
   * steps back out of it. Ordinal arithmetic cannot do this — both bodies have
   * an ordinal 0.
   */
  it("crosses into an inner work in both directions", () => {
    expect(neighbours(mot, "credits").next?.slug).toBe("no-silent-secret");
    expect(neighbours(mot, "no-silent-secret").previous?.slug).toBe("credits");
  });

  it("has no previous at the start and no next at the end", () => {
    expect(neighbours(mot, "welcome-to-theros").previous).toBeNull();
    expect(neighbours(mot, "credits-2").next).toBeNull();
  });

  it("gives a lone chapter neither", () => {
    expect(neighbours([{ slug: "only" }], "only")).toEqual({
      previous: null,
      next: null,
    });
  });

  /** A missing slug must not resolve to the ends of the list. */
  it("gives an unknown chapter neither", () => {
    expect(neighbours(mot, "no-such-chapter")).toEqual({
      previous: null,
      next: null,
    });
  });
});
