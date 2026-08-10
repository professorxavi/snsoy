import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as SuggestRoute from "./route";

/**
 * Smoke test: the typeahead endpoint, against the seeded database.
 *
 * A smoke test rather than a plain one because the handler's whole job is to
 * put a query in one end and rows from the corpus out of the other; stubbing
 * the query would leave only `Response.json`, which is not ours.
 *
 * What matters here is the contract the client depends on and cannot see: that
 * the reply echoes the query it answers — the client drops replies that do not
 * match, and an endpoint that stopped echoing would make every suggestion
 * silently vanish — and that a query too short to answer is refused here as
 * well as in the browser, since the URL can be typed directly.
 *
 * Skipped when DATABASE_URL is unset so the suite still runs without Postgres.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const get = async (route: typeof SuggestRoute, query: string) => {
  const response = await route.GET(
    new Request(`http://localhost/api/search/suggest?${query}`),
  );
  return {
    response,
    body: (await response.json()) as SuggestRoute.SuggestResponse,
  };
};

describeDb("GET /api/search/suggest", () => {
  let route: typeof SuggestRoute;

  beforeAll(async () => {
    route = await import("./route");
  });

  afterAll(async () => {
    const pool = (globalThis as { snsoyClient?: { end(): Promise<void> } })
      .snsoyClient;
    await pool?.end();
  });

  it("answers with suggestions and echoes the query", async () => {
    const { response, body } = await get(route, "q=fireball");

    expect(response.status).toBe(200);
    expect(body.q).toBe("fireball");
    expect(body.suggestions[0]!.name).toBe("Fireball");
    expect(body.suggestions[0]!.entityType).toBe("spell");
  });

  /**
   * The client compares the echo against what is in the field, so it has to be
   * the *normalised* query rather than the raw one — otherwise typing a
   * trailing space would make every reply look stale.
   */
  it("echoes the normalised query, not the raw one", async () => {
    const { body } = await get(route, "q=%20%20fire%20%20%20bolt%20%20");

    expect(body.q).toBe("fire bolt");
  });

  it("refuses a query too short to answer", async () => {
    const { body } = await get(route, "q=f");

    expect(body).toEqual({ q: "", suggestions: [] });
  });

  it("answers an absent query without failing", async () => {
    const { response, body } = await get(route, "");

    expect(response.status).toBe(200);
    expect(body.suggestions).toEqual([]);
  });

  /** Every row carries what the dropdown prints and where it goes. */
  it("returns rows the dropdown can render and follow", async () => {
    const { body } = await get(route, "q=sneak%20attack");
    const first = body.suggestions[0]!;

    expect(first).toMatchObject({
      name: "Sneak Attack",
      entityType: "classFeature",
      parentName: "Rogue",
      href: "/compendium/classes/phb/rogue#sneak-attack",
    });
  });

  it("caps the list", async () => {
    const { body } = await get(route, "q=fire");
    const { SUGGESTION_LIMIT } = await import("@/server/db/queries/search");

    expect(body.suggestions.length).toBeLessThanOrEqual(SUGGESTION_LIMIT);
  });
});
