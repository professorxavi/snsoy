import { describe, expect, it } from "vitest";
import { DIRECTORY, isImplemented } from "@/lib/compendium-directory";
import { listHrefFor } from "@/lib/routes";
import { render, screen } from "@/test/render";
import CompendiumPage from "./page";

/**
 * What the index puts on screen, given the directory.
 *
 * `compendium-directory.test.ts` owns the data — that every browsable type is
 * listed once and points at its own route. Nothing there covers the page's own
 * rules, which are the two below: an unbuilt type must not be a link, and a
 * card must say what the directory says and nothing more.
 *
 * Every expectation is derived from `DIRECTORY` rather than written as a
 * literal. The counts move whenever a browse view lands, and a test that has to
 * be edited on the way past is a test that gets edited without being read.
 */

const entries = DIRECTORY.flatMap((group) => group.entries);
const built = entries.filter((entry) => isImplemented(entry.type));
const unbuilt = entries.filter((entry) => !isImplemented(entry.type));

/** The card for a type, found by the label the directory gives it. */
const cardFor = (label: string) =>
  screen.getByText(label).closest("a, div[class]") as HTMLElement;

describe("the compendium index", () => {
  it("names every group", () => {
    render(<CompendiumPage />);

    for (const group of DIRECTORY) {
      expect(
        screen.getByRole("heading", { name: group.label, level: 2 }),
      ).toBeInTheDocument();
    }
  });

  it("shows a card for every type in the directory", () => {
    render(<CompendiumPage />);

    for (const entry of entries) {
      expect(screen.getByText(entry.label)).toBeInTheDocument();
      expect(screen.getByText(entry.blurb)).toBeInTheDocument();
    }
  });

  describe("types with a browse view", () => {
    it.each(built.map((entry) => [entry.label, entry.type] as const))(
      "links %s to its list route",
      (label, type) => {
        render(<CompendiumPage />);

        expect(cardFor(label).closest("a")).toHaveAttribute(
          "href",
          listHrefFor(type),
        );
      },
    );
  });

  describe("types with no browse view yet", () => {
    /**
     * A dimmed anchor would still be in the tab order and still announce
     * itself as a destination — to a 404. The card has to stop being a link,
     * not just look like it stopped.
     */
    it("renders them as inert cards rather than links", () => {
      render(<CompendiumPage />);

      const destinations = screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"));

      for (const entry of unbuilt) {
        expect(cardFor(entry.label).closest("a")).toBeNull();
        expect(destinations).not.toContain(listHrefFor(entry.type));
      }
    });

    it("says so on the card", () => {
      render(<CompendiumPage />);

      for (const entry of unbuilt) {
        expect(cardFor(entry.label)).toHaveTextContent("Not yet built");
      }
    });

    it("leaves exactly the built types linkable", () => {
      render(<CompendiumPage />);

      const listRoutes = screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
        .filter((href) => href?.startsWith("/compendium/"));

      expect(new Set(listRoutes)).toEqual(
        new Set(built.map((entry) => listHrefFor(entry.type))),
      );
    });
  });

  /**
   * The index is a way in, not a database report. A card that reads "Spells
   * 525" turns the product into a corpus browser, and the count would be a
   * query per card on a page that currently makes none.
   */
  it("puts nothing on a card but the directory's own words", () => {
    render(<CompendiumPage />);

    for (const entry of entries) {
      const expected = isImplemented(entry.type)
        ? `${entry.label}${entry.blurb}`
        : `${entry.label}${entry.blurb}Not yet built`;

      expect(cardFor(entry.label).textContent).toBe(expected);
    }
  });
});
