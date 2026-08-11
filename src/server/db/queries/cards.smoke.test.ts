import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as CardQueries from "./cards";

/**
 * Smoke test: the card queries against the seeded data.
 *
 * The deck is not a nicety here, it is half of a card's identity — five decks
 * deal a Jester, and the `set` field is the only thing separating those rows.
 * A facet reading it from the blob typechecks whatever it returns, so nothing
 * short of real data says whether the 23 decks are all there and whether the
 * list stays in a stable order across two requests for the same page.
 *
 * Counts are exact. Ingest runs once and every instance restores the same dump,
 * so a number that moves means the seed was re-cut or a query changed shape.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const CARDS = 656;
const DECKS = 23;

describeDb("card queries against the seed", () => {
  let queries: typeof CardQueries;

  beforeAll(async () => {
    queries = await import("./cards");
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  describe("listCards", () => {
    it("pages, and reports the whole total behind the page", async () => {
      const first = await queries.listCards();

      expect(first.total).toBe(CARDS);
      expect(first.rows).toHaveLength(queries.CARDS_PER_PAGE);
      expect(first.pageCount).toBe(Math.ceil(CARDS / queries.CARDS_PER_PAGE));
      expect(first.page).toBe(1);
    });

    /** A page past the end is clamped rather than served empty. */
    it("clamps a page beyond the last one", async () => {
      const page = await queries.listCards({ page: 999 });

      expect(page.page).toBe(page.pageCount);
      expect(page.rows).not.toHaveLength(0);
    });

    /**
     * Name alone is not a total order: 264 of the 656 share a name with a card
     * from another deck, so the second key is what stops those rows reshuffling
     * between two requests for the same page.
     */
    it("orders by name then deck", async () => {
      const { rows } = await queries.listCards();
      const keys = rows.map((row) => `${row.name}|${row.deck}`);

      expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    });

    it("narrows to one deck", async () => {
      const { rows, total } = await queries.listCards({ decks: ["Tarokka Deck"] });

      expect(total).toBe(54);
      expect(rows.every((row) => row.deck === "Tarokka Deck")).toBe(true);
    });

    /** The suit and its rank, for the 168 cards that have one. */
    it("brings back the fields the rank is built from", async () => {
      const { rows } = await queries.listCards({
        decks: ["Tarokka Deck"],
        q: "Avenger",
      });

      expect(rows[0]).toMatchObject({ suit: "Swords", value: "1" });
    });
  });

  describe("cardFacets", () => {
    it("counts every deck, and never more cards than there are", async () => {
      const { decks } = await queries.cardFacets();

      expect(decks).toHaveLength(DECKS);
      expect(decks.every((facet) => facet.count <= CARDS)).toBe(true);
      expect(decks.map((facet) => facet.value)).toContain("Deck of Many Things");
    });

    /**
     * The facet is counted against the *other* filters, so a selected deck must
     * keep its own count and match what the list returns.
     */
    it("counts a selected deck against the list it produces", async () => {
      const filters = { decks: ["Deck of Illusions"] };
      const [{ total }, { decks }] = await Promise.all([
        queries.listCards(filters),
        queries.cardFacets(filters),
      ]);

      const illusions = decks.find((facet) => facet.value === "Deck of Illusions");
      expect(illusions?.selected).toBe(true);
      expect(illusions?.count).toBe(total);
    });
  });

  /**
   * A deck lists its cards as bare `name|set|source` addresses, and the panel
   * puts them back into `{@card}` form so they resolve like any other
   * reference. Nothing but the seed says whether those two agree — a form that
   * looked right and matched nothing would still typecheck, still render, and
   * still print every card in every deck as a dead word.
   */
  it("resolves every card of every deck by natural key", async () => {
    const { eq, inArray } = await import("drizzle-orm");
    const { db } = await import("../client");
    const { genericEntities } = await import("../schema/content");
    const { entities } = await import("../schema/entities");
    const { collectReferences } = await import("@/lib/content/references");
    const { deckCardTags } = await import("@/lib/content/cards");
    const { resolveReferences } = await import("./references");

    const decks = await db
      .select({ name: entities.name, data: genericEntities.data })
      .from(genericEntities)
      .innerJoin(entities, eq(entities.id, genericEntities.entityId))
      .where(inArray(entities.entityType, ["deck"]));

    const tags = decks.flatMap((deck) => deckCardTags(deck.data));
    const keys = [...collectReferences(tags)];
    const index = await resolveReferences(keys);

    expect(keys.length).toBeGreaterThan(500);
    expect(keys.filter((key) => !index[key])).toEqual([]);
  });
});
