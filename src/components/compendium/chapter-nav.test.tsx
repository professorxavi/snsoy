import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/test/render";
import { ChapterBar, type ChapterNeighbour } from "./chapter-nav";

/**
 * The bar above a chapter title.
 *
 * The chapter page proves the three destinations are wired to the right values.
 * What is left here is the bar's own judgement about when a destination is
 * worth offering at all — a "Contents" link on a book that is one chapter long
 * leads to a list of the page the reader is already on.
 */

const CLASSES: ChapterNeighbour = {
  name: "Classes",
  slug: "classes",
  ordinalType: "chapter",
  ordinalLabel: "3",
};

const EQUIPMENT: ChapterNeighbour = {
  name: "Equipment",
  slug: "equipment",
  ordinalType: "chapter",
  ordinalLabel: "5",
};

const bar = (over: Partial<Parameters<typeof ChapterBar>[0]> = {}) => (
  <ChapterBar
    sourceId="PHB"
    sourceName="Player's Handbook"
    previous={CLASSES}
    next={EQUIPMENT}
    hasContents
    {...over}
  />
);

const barLinks = () =>
  within(screen.getByRole("navigation", { name: "Chapter" })).getAllByRole(
    "link",
  );

const links = () => barLinks().map((link) => link.getAttribute("href"));

const linkTo = (href: string) =>
  barLinks().find((link) => link.getAttribute("href") === href);

describe("the chapter bar", () => {
  it("offers back, the book's contents, and forward, in that order", () => {
    render(bar());

    expect(links()).toEqual([
      "/sources/phb/classes",
      "/sources/phb",
      "/sources/phb/equipment",
    ]);
  });

  /** Three chapters called "Contents" in a screen reader's link list is no list. */
  it("names the contents link after the book it belongs to", () => {
    render(bar());

    expect(
      screen.getByRole("link", { name: "Contents of Player's Handbook" }),
    ).toBeInTheDocument();
  });

  /**
   * Asserted on the text rather than the accessible name: the number sits in a
   * span the narrow layout hides, jsdom only ever sees the base `display: none`
   * of that media query, and a name computation drops hidden text.
   */
  it("numbers a neighbour that was printed with a number", () => {
    render(bar());

    expect(linkTo("/sources/phb/equipment")).toHaveTextContent(
      "Ch. 5 · Equipment",
    );
  });

  /** Front matter and credits carry no ordinal, and must not invent one. */
  it("names an unnumbered neighbour by name alone", () => {
    render(
      bar({
        previous: {
          name: "Introduction",
          slug: "introduction",
          ordinalType: null,
          ordinalLabel: null,
        },
      }),
    );

    expect(linkTo("/sources/phb/introduction")).toHaveTextContent(
      /^Introduction$/,
    );
  });

  it("still offers the contents at either end of the book", () => {
    render(bar({ previous: null, next: null }));

    expect(links()).toEqual(["/sources/phb"]);
  });

  /**
   * A source whose entire body is this chapter. With nowhere to go the bar is
   * an empty rule across the top of the page, so there is no bar.
   */
  it("renders nothing when there is nowhere to go", () => {
    render(bar({ previous: null, next: null, hasContents: false }));

    expect(
      screen.queryByRole("navigation", { name: "Chapter" }),
    ).not.toBeInTheDocument();
  });
});
