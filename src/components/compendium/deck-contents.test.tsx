import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { CardFace } from "./card-face";
import { DeckContents } from "./deck-contents";

/**
 * A deck is its list of cards, and a card is largely its picture. Both are
 * things the panel prints from outside `entries`, and both were dead before
 * this batch — the cards because `{@card}` built a key without a deck in it.
 */

const ctx = { refs: {}, selfKey: "deck|test|xxx", context: "Test" };

describe("DeckContents", () => {
  /**
   * The cards are stored as bare `name|set|source` addresses. Put back in tag
   * form they resolve like any other reference, which is what makes a deck's
   * contents a way in rather than a list of words.
   */
  it("links every card it deals", () => {
    render(
      <DeckContents
        data={{ cards: ["Talons|Deck of Many Things|DMG"] }}
        refs={{
          "card|talons|deck of many things|dmg": {
            name: "Talons",
            entityType: "card",
            href: "/compendium/cards/dmg/talons",
          },
        }}
        selfKey={ctx.selfKey}
        context={ctx.context}
      />,
    );

    expect(screen.getByRole("link", { name: "Talons" })).toHaveAttribute(
      "href",
      "/compendium/cards/dmg/talons",
    );
  });

  it("counts a repeated card rather than repeating the row", () => {
    render(
      <DeckContents
        data={{
          cards: [
            "Goblin|Deck of Illusions|DMG",
            "Goblin|Deck of Illusions|DMG",
          ],
        }}
        {...ctx}
      />,
    );

    expect(screen.getAllByText("Goblin")).toHaveLength(1);
    expect(screen.getByText("×2")).toBeInTheDocument();
  });

  it("renders nothing at all for a deck with no cards", () => {
    const { container } = render(<DeckContents data={{}} {...ctx} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("CardFace", () => {
  /** 67 cards carry no text, so the picture is the whole of what is shown. */
  it("prints the face, named after the card", () => {
    render(
      <CardFace
        face={{
          type: "image",
          href: { type: "internal", path: "decks/DMG/Deck of Many Things/11-talons.webp" },
          width: 742,
          height: 959,
        }}
        name="Talons"
      />,
    );

    expect(screen.getByRole("img", { name: "Talons" })).toBeInTheDocument();
  });

  it("renders nothing where there is no face", () => {
    const { container } = render(<CardFace face={undefined} name="Talons" />);

    expect(container).toBeEmptyDOMElement();
  });
});
