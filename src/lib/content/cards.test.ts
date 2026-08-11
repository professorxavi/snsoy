import { describe, expect, it } from "vitest";
import { cardRank, cardSubtitle, deckCardTags, deckCards, deckSize } from "./cards";

/**
 * Every shape here is one the data actually holds. The two that matter are the
 * ones the decks disagree about: 23 list their cards as bare strings and 8 as
 * `{uid, count}` objects, and a reader of only one of those forms leaves either
 * two thirds or a third of the decks empty.
 */

describe("cardRank", () => {
  /** A tarot card spells its number out; a tarokka card names its rank. */
  it("prints the suit with whatever the card calls its rank", () => {
    expect(cardRank({ suit: "Wisdom", value: 8, valueName: "Eight" })).toBe(
      "Wisdom 8 (Eight)",
    );
    expect(cardRank({ suit: "Swords", value: 10, valueName: "master" })).toBe(
      "Swords 10 (master)",
    );
  });

  it("prints the suit alone where there is no rank", () => {
    expect(cardRank({ suit: "Snacks" })).toBe("Snacks");
    expect(cardRank({ suit: "Coins", value: 3 })).toBe("Coins 3");
  });

  /** 488 of the 656 have no suit at all — a Deck of Illusions card has none. */
  it("is empty where the card has no suit", () => {
    expect(cardRank({})).toBe("");
  });
});

describe("cardSubtitle", () => {
  it("leads with the deck, which is half the card's identity", () => {
    expect(cardSubtitle({ set: "Tarokka Deck", suit: "Swords", value: 1 })).toBe(
      "Tarokka Deck · Swords 1",
    );
  });

  it("is the deck alone where the card has no rank", () => {
    expect(cardSubtitle({ set: "Deck of Many Things" })).toBe(
      "Deck of Many Things",
    );
  });
});

describe("deckCards", () => {
  /** The 23 decks that list their cards as `name|set|source` strings. */
  it("reads the string form", () => {
    expect(
      deckCards({ cards: ["Red Dragon|Deck of Illusions|DMG"] }),
    ).toEqual([{ tag: "{@card Red Dragon|Deck of Illusions|DMG}", count: 1 }]);
  });

  /** The 8 that list `{uid, count}` objects instead. */
  it("reads the object form and its count", () => {
    expect(
      deckCards({
        cards: [{ uid: "Combat Step by Step|Combat Step by Step Cards|ESK", count: 3 }],
      }),
    ).toEqual([
      { tag: "{@card Combat Step by Step|Combat Step by Step Cards|ESK}", count: 3 },
    ]);
  });

  /**
   * A Deck of Illusions deals two Goblins, and the deck lists the address
   * twice. Printing the row twice says nothing the count does not.
   */
  it("folds a repeated card into a count", () => {
    expect(
      deckCards({
        cards: [
          "Goblin|Deck of Illusions|DMG",
          "Lich|Deck of Illusions|DMG",
          "Goblin|Deck of Illusions|DMG",
        ],
      }),
    ).toEqual([
      { tag: "{@card Goblin|Deck of Illusions|DMG}", count: 2 },
      { tag: "{@card Lich|Deck of Illusions|DMG}", count: 1 },
    ]);
  });

  it("yields nothing for a deck with no card list", () => {
    expect(deckCards({})).toEqual([]);
    expect(deckCards({ cards: "not an array" })).toEqual([]);
  });

  /**
   * A list row reads the field as the JSON text `->>` produced, while the panel
   * has the parsed value. Both go through this.
   */
  it("reads the field as JSON text too", () => {
    expect(deckSize('["Goblin|Deck of Illusions|DMG"]')).toBe(1);
  });
});

describe("deckSize", () => {
  it("counts duplicates, because a deck holds them", () => {
    expect(
      deckSize([
        "Goblin|Deck of Illusions|DMG",
        "Goblin|Deck of Illusions|DMG",
        "Lich|Deck of Illusions|DMG",
      ]),
    ).toBe(3);
  });
});

describe("deckCardTags", () => {
  it("gives the resolver one tag per distinct card", () => {
    expect(
      deckCardTags({
        cards: ["Jester|Deck of Many Things|DMG", "Jester|Deck of Many Things|DMG"],
      }),
    ).toEqual(["{@card Jester|Deck of Many Things|DMG}"]);
  });
});
