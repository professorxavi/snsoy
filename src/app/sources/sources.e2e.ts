import { expect, test } from "@playwright/test";
import { expectHydrated } from "@/test/e2e-helpers";

/**
 * How a chapter's tables come out once a browser has laid them out.
 *
 * A table is the one block in a chapter whose rendering is decided after the
 * markup leaves the server. The widths a table is set to are advisory — the
 * engine weighs them against the content and the room available — so nothing
 * short of a real layout can tell a table that reads like the printed page from
 * one where a column of sentences has collapsed to a word a line while a
 * neighbour runs off the edge. That is the state this page was in, and it is
 * invisible to markup assertions: the same elements, the same classes, the same
 * text, all present and correct.
 *
 * One page carries it. Every table in the corpus goes through one renderer, and
 * the class table is the hard case — six columns, two of them prose — on the
 * layout that grants a table room beyond the reading measure.
 */

const CLASSES = "/sources/phb/classes";

test("sets a table's columns to the shares it was printed with", async ({
  page,
}) => {
  await page.goto(CLASSES);
  await expectHydrated(page);

  const widths = await page.evaluate(() =>
    [...document.querySelectorAll("table thead th")].map(
      (cell) => cell.getBoundingClientRect().width,
    ),
  );

  const [narrow, prose] = [0, 1];
  expect(widths).toHaveLength(6);

  // "Description" is set four times the width of "Class". Nothing here asserts
  // the exact ratio — content still moves the boundaries — only that the two
  // are no longer within a hair of each other, which is the collapse itself.
  expect(widths[prose]).toBeGreaterThan(widths[narrow] * 2);
});

/**
 * A six-column table does not fit a column set for prose, and squeezing it into
 * one is what broke it. It may use the margins instead — but only as far as the
 * page allows, and never far enough to scroll the document sideways.
 */
test("lets a wide table past the reading measure without scrolling the page", async ({
  page,
}) => {
  await page.goto(CLASSES);
  await expectHydrated(page);

  // A paragraph on the same page is the measure, measured rather than assumed.
  const paragraph = await page.locator("p.prose").first().boundingBox();
  const table = await page.locator("table").first().boundingBox();

  expect(table!.width).toBeGreaterThan(paragraph!.width);

  // Centred on the same column, not shunted to one side.
  const centre = (box: { x: number; width: number }) => box.x + box.width / 2;
  expect(Math.abs(centre(table!) - centre(paragraph!))).toBeLessThan(4);

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);
});
