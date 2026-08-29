import { expect, test, type Page } from "@playwright/test";

/**
 * Does any line of set copy end on a word by itself?
 *
 * The product's own voice is a dozen single sentences: one under each
 * compendium title, one on each card of the type directory, and the promise on
 * the landing page. They are short enough that the last line often holds a
 * single word — "it.", "costs.", "grow.", "size." — which is the one wrapping
 * fault a reader notices without knowing why, and the reason every one of those
 * paragraphs carries `text-wrap: pretty`.
 *
 * Only a browser can answer it. The fault is a property of the rendered line
 * boxes and not of the markup, so jsdom cannot see it and neither can a
 * snapshot: the DOM is identical either way.
 *
 * Measured by walking the text node with a `Range` and grouping the words by
 * the top of their rectangle, which is the only way to ask where a line broke.
 * A paragraph that fits on one line has no last line to be alone on and is
 * skipped.
 */

/** Every word on the last visual line of each matching paragraph. */
async function lastLines(page: Page, selector: string) {
  return page.evaluate((match) => {
    const measured: { text: string; tail: string[] }[] = [];

    for (const node of document.querySelectorAll(match)) {
      const child = node.firstChild;
      if (!child || child.nodeType !== Node.TEXT_NODE) continue;

      const text = node.textContent ?? "";
      const words: { word: string; top: number }[] = [];

      let start = 0;
      for (let at = 0; at <= text.length; at++) {
        if (at < text.length && !/\s/.test(text[at]!)) continue;
        if (at > start) {
          const range = document.createRange();
          range.setStart(child, start);
          range.setEnd(child, at);
          words.push({
            word: text.slice(start, at),
            top: Math.round(range.getBoundingClientRect().top),
          });
        }
        start = at + 1;
      }

      if (words.length === 0) continue;

      const last = words[words.length - 1]!.top;
      // One line means nothing wrapped, so nothing can be stranded.
      if (words.every((entry) => entry.top === last)) continue;

      measured.push({
        text: text.trim(),
        tail: words.filter((entry) => entry.top === last).map((w) => w.word),
      });
    }

    return measured;
  }, selector);
}

const orphans = (lines: { text: string; tail: string[] }[]) =>
  lines.filter((line) => line.tail.length === 1).map((line) => line.text);

/**
 * The landing page and the type directory, across the widths that broke them.
 *
 * Every width, because a card's blurb is stranded at some sizes and not others
 * — the directory is a four-column grid on a desktop and one column on a phone,
 * so each breakpoint gives the same sentence a different measure. "grow." and
 * "size." only appeared from 1280px up.
 */
for (const width of [390, 768, 1024, 1280, 1680]) {
  test(`sets no word alone at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const route of ["/", "/compendium"]) {
      await page.goto(route);
      const lines = await lastLines(page, ".prose");

      // A selector that matches nothing would pass every assertion below it.
      expect(lines.length, `${route} measured no wrapped copy`).toBeGreaterThan(
        0,
      );
      expect(orphans(lines), route).toEqual([]);
    }
  });
}

/**
 * The sentence under each compendium title, at the narrowest measure the app
 * supports — which is where a header line has the least room and where four of
 * these were stranded.
 */
test("ends no compendium page header on an orphan", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });

  const ROUTES = [
    "actions",
    "classes",
    "conditions",
    "decks",
    "diseases",
    "languages",
    "races",
    "sidekicks",
    "skills",
    "variant-rules",
    "vehicles",
  ];

  const stranded: string[] = [];

  for (const route of ROUTES) {
    await page.goto(`/compendium/${route}`);
    stranded.push(...orphans(await lastLines(page, ".prose")));
  }

  expect(stranded).toEqual([]);
});
