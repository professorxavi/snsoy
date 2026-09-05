import { beforeAll, describe, expect, it } from "vitest";
import type * as HealthRoute from "./route";

/**
 * Smoke test: the health check against a real database.
 *
 * The whole point of this endpoint is that it reaches Postgres rather than
 * reporting its own liveness, so a test with a mocked database would assert the
 * opposite of what matters. The 503 path is deliberately not exercised — faking
 * a hung connection proves the mock works, not the route.
 *
 * Skipped when DATABASE_URL is unset, like the other smoke tests.
 */

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("the health endpoint against the seed", () => {
  let route: typeof HealthRoute;

  // Imported late: the module reaches the env schema through the db client,
  // which throws at import time when DATABASE_URL is missing.
  beforeAll(async () => {
    route = await import("./route");
  });

  it("reports ok while the database answers", async () => {
    const response = await route.GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  /**
   * A cached health check reports the state of a machine at some point in the
   * past, forever. Cloudflare sits in front of this origin with a deliberately
   * aggressive HTML cache rule, so the header is the only thing keeping it out.
   */
  it("forbids caching", async () => {
    const response = await route.GET();

    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  /** Status and nothing else — no version, no counts, no error text. */
  it("gives away nothing beyond the status", async () => {
    const body = (await (await route.GET()).json()) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual(["status"]);
  });
});
