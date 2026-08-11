import { fieldValue } from "./field";

/**
 * Cards and the decks that deal them.
 *
 * A card is addressed by its deck as well as its name — five decks deal a
 * Jester — so the deck travels with a card everywhere: in its natural key, in
 * the tag that points at it, in the list column and in the line under its name.
 * See `candidateKeysForTag`.
 */

const EM_DASH = "—";

/** The deck a card belongs to, as the blob's `set` field names it. */
export function cardDeck(value: unknown): string {
  const set = fieldValue(value);
  return typeof set === "string" && set.length > 0 ? set : EM_DASH;
}

/**
 * "Swords 10 (master)" — where a card has a place in a suit.
 *
 * 168 of the 656 do. A Tarokka card names its rank in words rather than by
 * number ("master of swords"), while a tarot card spells the number out, so
 * both are printed beside the numeral rather than in place of it.
 */
export function cardRank(data: Record<string, unknown>): string {
  const suit = fieldValue(data["suit"]);
  if (typeof suit !== "string" || !suit) return "";

  const value = fieldValue(data["value"]);
  const name = fieldValue(data["valueName"]);

  const rank = [
    value == null ? "" : String(value),
    typeof name === "string" && name ? `(${name})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return rank ? `${suit} ${rank}` : suit;
}

/** "Tarokka Deck · Swords 10 (master)", for the line under a card's name. */
export function cardSubtitle(data: Record<string, unknown>): string {
  return [cardDeck(data["set"]), cardRank(data)].filter((part) => part && part !== EM_DASH)
    .join(" · ");
}

/** One card in a deck's list, with however many copies the deck holds. */
export interface DeckMember {
  /** A `{@card}` tag, so the name resolves through the shared reference index. */
  tag: string;
  count: number;
}

/**
 * A deck's cards, as tags the renderer can resolve.
 *
 * Stored as `name|set|source` addresses — the same three parts a `{@card}` tag
 * carries — so putting them back in tag form is what makes a deck's contents a
 * list of live links rather than 31 dead names. Written two ways: 23 decks list
 * bare strings and 8 list `{uid, count}` objects, where a deck holds more than
 * one of the same card.
 *
 * Repeats are folded together with a count, because a Deck of Illusions deals
 * two Goblins and printing the row twice says nothing the count does not.
 */
export function deckCards(data: { cards?: unknown }): DeckMember[] {
  const cards = fieldValue(data.cards);
  if (!Array.isArray(cards)) return [];

  const members = new Map<string, DeckMember>();

  for (const card of cards) {
    const uid =
      typeof card === "string"
        ? card
        : (card as { uid?: unknown } | null)?.uid;
    if (typeof uid !== "string" || !uid) continue;

    const copies = (card as { count?: unknown } | null)?.count;
    const count = typeof copies === "number" && copies > 0 ? copies : 1;

    const existing = members.get(uid);
    if (existing) existing.count += count;
    else members.set(uid, { tag: `{@card ${uid}}`, count });
  }

  return [...members.values()];
}

/** Just the tags, for `collectReferences` to resolve in one query. */
export function deckCardTags(data: { cards?: unknown }): string[] {
  return deckCards(data).map((member) => member.tag);
}

/**
 * How many cards a deck holds, counting duplicates — a Deck of Illusions is 34
 * cards, not the 31 distinct ones it deals.
 */
export function deckSize(cards: unknown): number {
  return deckCards({ cards }).reduce((total, card) => total + card.count, 0);
}
