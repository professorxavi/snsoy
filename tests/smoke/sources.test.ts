import { describe, expect, it } from "vitest";

/**
 * Smoke test: fetch the `/sources` routes from a running instance.
 *
 * Everything below is asserted against server-rendered HTML rather than a live
 * browser. That is deliberate — the questions worth asking here are "did the
 * page render at all", "did it render the right rows" and "did the tags in the
 * prose become links", none of which need a DOM. Layout and interception do
 * need a real browser; nothing in this file pretends to cover them.
 *
 * Runs only when SMOKE_BASE_URL points at an instance — a dev server, a
 * preview deployment — because unlike the rest of the suite it needs one.
 */

const BASE = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");
const describeApp = BASE ? describe : describe.skip;

async function get(path: string) {
  const response = await fetch(`${BASE}${path}`);
  return { status: response.status, html: await response.text() };
}

/** Every distinct href on the page matching a pattern, in document order. */
function hrefs(html: string, pattern: RegExp): string[] {
  const found = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
  return [...new Set(found.filter((href) => pattern.test(href)))];
}

/**
 * The text a reader sees. Scripts have to go first: Next inlines the RSC
 * payload into the document, so the page's own unrendered source data is
 * sitting in the HTML next to the markup rendered from it.
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

const SOURCE_CARD = /^\/sources\/[^/?#]+$/;
const CHAPTER = /^\/sources\/[^/?#]+\/[^/?#]+$/;

describeApp("the sources routes render", () => {
  describe("the index", () => {
    it("shows every source with a body and hides the rest", async () => {
      const { status, html } = await get("/sources");

      expect(status).toBe(200);
      expect(hrefs(html, SOURCE_CARD)).toHaveLength(130);
      expect(hrefs(html, SOURCE_CARD)).not.toContain("/sources/tftyp");
      expect(hrefs(html, SOURCE_CARD)[0]).toBe("/sources/phb");
    });

    it("filters by kind", async () => {
      const books = await get("/sources?kind=books");
      const adventures = await get("/sources?kind=adventures");

      expect(hrefs(books.html, SOURCE_CARD)).toHaveLength(51);
      expect(hrefs(adventures.html, SOURCE_CARD)).toHaveLength(79);
    });
  });

  describe("a source", () => {
    it("lists a book's chapters", async () => {
      const { status, html } = await get("/sources/phb");
      const chapters = hrefs(html, CHAPTER);

      expect(status).toBe(200);
      expect(prose(html)).toContain("Player's Handbook");
      expect(chapters).toHaveLength(16);
      expect(chapters[0]).toBe("/sources/phb/introduction");
      expect(chapters.at(-1)).toBe("/sources/phb/credits");
    });

    it("prints an inner work after the body containing it", async () => {
      const { html } = await get("/sources/mot");
      const chapters = hrefs(html, CHAPTER);

      expect(chapters).toHaveLength(10);
      expect(chapters.slice(-3)).toEqual([
        "/sources/mot/credits",
        "/sources/mot/no-silent-secret",
        "/sources/mot/credits-2",
      ]);
      expect(prose(html)).toContain("No Silent Secret");
    });

    it("explains a source that has no body rather than 404ing", async () => {
      const { status, html } = await get("/sources/tftyp");

      expect(status).toBe(200);
      expect(prose(html)).toContain("No chapters have been loaded");
      expect(hrefs(html, CHAPTER)).toEqual([]);
    });

    it("404s on a source that does not exist", async () => {
      expect((await get("/sources/no-such-book")).status).toBe(404);
    });
  });

  describe("a chapter", () => {
    it("renders the body with its structure intact", async () => {
      const { status, html } = await get("/sources/phb/combat");

      expect(status).toBe(200);
      expect(prose(html)).toContain("Combat");
      expect(prose(html)).toContain("Chapter 9");
      expect(html).toContain('href="/sources/phb"');
      // Sections become h2s, and the outline anchors them.
      expect(html).toMatch(/<h2/);
      expect(hrefs(html, /^#/).length).toBeGreaterThan(4);
      expect(html).toMatch(/<table/);
    });

    /**
     * The renderer's real job: an unhandled entry type or an unresolved tag
     * leaves corpus markup sitting in the prose where a link should be.
     */
    it("turns inline tags into compendium links", async () => {
      const { html } = await get("/sources/phb/combat");

      expect(hrefs(html, /^\/compendium\//).length).toBeGreaterThan(5);
      expect(prose(html)).not.toMatch(/\{@\w+ /);
    });

    it("offers the chapters either side", async () => {
      const { html } = await get("/sources/phb/combat");

      expect(hrefs(html, CHAPTER)).toEqual([
        "/sources/phb/adventuring",
        "/sources/phb/spellcasting",
      ]);
    });

    it("crosses the seam into an inner work", async () => {
      const { html } = await get("/sources/mot/credits");

      expect(hrefs(html, CHAPTER)).toContain("/sources/mot/no-silent-secret");
    });

    it("404s on a chapter that does not exist", async () => {
      expect((await get("/sources/phb/no-such-chapter")).status).toBe(404);
    });
  });
});
