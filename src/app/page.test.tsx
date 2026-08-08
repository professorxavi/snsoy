import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import Home from "./page";

/**
 * The landing page is three doors and a masthead.
 *
 * Worth a test only because the doors are the entry point to everything else:
 * a card that stops linking, or links somewhere that no longer exists, strands
 * the whole product behind a URL the reader has to already know.
 */

const cardHrefs = () =>
  screen.getAllByRole("link").map((link) => link.getAttribute("href"));

describe("the landing page", () => {
  it("names the product", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /over Yonder/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("offers a way into each of the three areas", () => {
    render(<Home />);

    expect(cardHrefs()).toEqual(["/compendium", "/sources", "/characters"]);
  });

  it("gives every card a title and a description", () => {
    render(<Home />);

    for (const title of ["Compendium", "Sources", "Characters"]) {
      const card = screen.getByText(title).closest("a")!;
      expect(card).toBeInTheDocument();
      // Title plus body — a card with no body is a card that says nothing.
      expect(card.textContent!.length).toBeGreaterThan(title.length + 40);
    }
  });
});
