import { expect, test } from "@playwright/test";
import { ASIDE, expectHydrated } from "@/test/e2e-helpers";

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

/**
 * Opening an entity from the prose.
 *
 * A chapter is dense with cross-references — 36,000 across the corpus — and
 * following one used to cost the page you were reading. Now it opens beside the
 * text instead. None of this is visible to a markup assertion: whether the
 * click was intercepted at all depends on the capture phase beating
 * `next/link`'s own handler, and whether the prose held still is computed
 * layout.
 */
test("opens a class from the chapter without leaving it", async ({ page }) => {
  await page.goto(CLASSES);
  await expectHydrated(page);

  // Where the prose sits before anything opens. The drawer floats over the
  // page precisely so this does not change.
  const measure = () =>
    page.evaluate(() => {
      const box = document
        .querySelector("p.prose")
        ?.getBoundingClientRect();
      return box ? { x: Math.round(box.x), w: Math.round(box.width) } : null;
    });
  const before = await measure();

  await page.getByRole("link", { name: "Barbarian" }).first().click();

  await expect(page.locator(`${ASIDE} h1`)).toHaveText("Barbarian");
  await expect(page).toHaveURL(new RegExp(`${CLASSES}$`));
  expect(await measure()).toEqual(before);
});

/** The summary, not the class page shrunk into a column. */
test("shows a class summary rather than the whole class", async ({ page }) => {
  await page.goto(CLASSES);
  await expectHydrated(page);

  await page.getByRole("link", { name: "Barbarian" }).first().click();
  await expect(page.locator(`${ASIDE} h1`)).toHaveText("Barbarian");

  const aside = page.locator(ASIDE);
  await expect(aside.getByText("9 Primal Paths")).toBeVisible();
  await expect(aside.locator("table")).toHaveCount(0);
  await expect(aside.getByRole("link", { name: /full page/i })).toBeVisible();
});

test("closes on Escape, leaving the chapter where it was", async ({ page }) => {
  await page.goto(CLASSES);
  await expectHydrated(page);

  const depth = () => page.evaluate(() => history.length);
  const before = await depth();

  for (const name of ["Barbarian", "Bard", "Cleric"]) {
    await page.getByRole("link", { name, exact: true }).first().click();
    await expect(page.locator(`${ASIDE} h1`)).toHaveText(name);
  }

  // Reading three classes is three calls and no navigations.
  expect(await depth()).toBe(before);

  await page.keyboard.press("Escape");
  await expect(page.locator(ASIDE)).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${CLASSES}$`));
});

/**
 * A type with no aside renderer must behave exactly as it did before the
 * wrapper existed. Most of what book text links to is in this state — 15,887
 * monster references alone — and quietly swallowing those clicks would be worse
 * than the navigation they currently perform.
 */
test("leaves a link it cannot render to navigate as before", async ({
  page,
}) => {
  await page.goto("/sources/phb/equipment");
  await expectHydrated(page);

  const item = page.locator('a[href^="/compendium/items/"]').first();
  test.skip((await item.count()) === 0, "no item links in this chapter");

  const href = await item.getAttribute("href");
  await item.click();

  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.locator(ASIDE)).toHaveCount(0);
});
