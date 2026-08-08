import { describe, expect, it } from "vitest";

/**
 * Smoke test: are the `/sources` routes actually up and serving real pages?
 *
 * Deliberately shallow. What each page puts on screen is covered by the page's
 * own component test, and what the queries return by their smoke test against
 * the database; neither needs a server, and both give a better failure message
 * than an HTTP status. What only a running instance can answer is whether the
 * whole stack is wired together — that the route resolves, the query reaches
 * Postgres, and the page renders instead of throwing.
 *
 * The failure this exists to catch is total: a route that 500s for every URL
 * under it. That has happened, and the pages were fine both times.
 *
 * Runs only when SMOKE_BASE_URL points at an instance — a dev server, a preview
 * deployment. Skipped without one.
 */

const BASE = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");
const describeApp = BASE ? describe : describe.skip;

async function get(path: string) {
  const response = await fetch(`${BASE}${path}`);
  return { status: response.status, html: await response.text() };
}

/**
 * The text a reader sees. Scripts have to go first: Next inlines the RSC
 * payload into the document, so the page's own source data sits in the HTML
 * beside the markup rendered from it — and a page that rendered nothing at all
 * would still "contain" every string you thought to look for.
 */
function prose(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}

describeApp("the sources routes are served", () => {
  it("serves the index from the database", async () => {
    const { status, html } = await get("/sources");

    expect(status).toBe(200);
    expect(prose(html)).toContain("Player's Handbook");
  });

  it("serves a source", async () => {
    const { status, html } = await get("/sources/phb");

    expect(status).toBe(200);
    expect(html).toContain('href="/sources/phb/combat"');
  });

  /** The heaviest page in the app: a chapter body with its references resolved. */
  it("serves a chapter with its prose rendered", async () => {
    const { status, html } = await get("/sources/phb/combat");

    expect(status).toBe(200);
    expect(prose(html)).toContain("Combat");
    expect(html).toContain('href="/compendium/');
    expect(prose(html)).not.toMatch(/\{@\w+ /);
  });

  it("404s below the route rather than erroring", async () => {
    expect((await get("/sources/no-such-book")).status).toBe(404);
    expect((await get("/sources/phb/no-such-chapter")).status).toBe(404);
  });
});
