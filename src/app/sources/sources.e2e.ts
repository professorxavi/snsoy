import { expect, test } from "@playwright/test";
import { ASIDE, expectHydrated, expectInView } from "@/test/e2e-helpers";

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
 * A wide table keeps to the reading measure and scrolls in its own box.
 *
 * It used to reach out into the margins instead. That stopped the columns being
 * cut off, but left the table half again the width of the prose around it,
 * which is conspicuous in a layout whose whole point is one measured column.
 * Nothing is lost by keeping it in: what does not fit is reachable by scrolling
 * the table, and the page itself never scrolls sideways.
 */
test("keeps a wide table inside the reading measure", async ({ page }) => {
  await page.goto(CLASSES);
  await expectHydrated(page);

  // A paragraph on the same page is the measure, measured rather than assumed.
  const paragraph = (await page.locator("p.prose").first().boundingBox())!;

  // The scroll container, not the table: the table may be wider than the
  // measure and scroll inside it, which is the point. What must line up with
  // the prose is the box it scrolls in.
  const container = await page
    .locator("table")
    .first()
    .evaluate((el) => {
      const { x, width } = el.closest("div")!.getBoundingClientRect();
      return { x, width };
    });

  expect(Math.abs(container.x - paragraph.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(container.width - paragraph.width)).toBeLessThanOrEqual(1);

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);
});

/**
 * Whatever does not fit is still reachable. The container scrolls rather than
 * clipping, which is what makes keeping the table inside the measure honest
 * rather than a way of hiding columns.
 */
test("leaves an over-wide table scrollable rather than clipped", async ({
  page,
}) => {
  await page.goto("/compendium/classes/phb/sorcerer");
  await expectHydrated(page);

  const box = await page.evaluate(() => {
    const table = document.querySelector("main table");
    const wrap = table?.closest("div");
    if (!wrap) return null;
    return {
      overflows: wrap.scrollWidth > wrap.clientWidth,
      canScroll: getComputedStyle(wrap).overflowX,
    };
  });

  // A Sorcerer carries nine spell-slot columns and does not fit; that is the
  // case worth pinning, since it is the one a reader has to scroll.
  expect(box?.overflows).toBe(true);
  expect(box?.canScroll).toBe("auto");
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
 * wrapper existed. Much of what book text links to is still in this state —
 * deities lead what is left at 535 references, cards at 481 — and quietly
 * swallowing those clicks would be worse than the navigation they perform.
 *
 * This has cited creatures, then items, then actions in turn, and each was
 * retired as its renderer landed. The link exercised here has to stay one of
 * the types the aside genuinely cannot render, or the test passes without
 * asserting anything. This chapter carries 195 `{@deity}` tags, so it will hold
 * until that slice is built — and then this moves again.
 */
test("leaves a link it cannot render to navigate as before", async ({
  page,
}) => {
  await page.goto("/sources/phb/gods-of-the-multiverse");
  await expectHydrated(page);

  const item = page.locator('a[href^="/compendium/deities/"]').first();
  test.skip((await item.count()) === 0, "no deity links in this chapter");

  const href = await item.getAttribute("href");
  await item.scrollIntoViewIfNeeded();
  await item.click();

  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.locator(ASIDE)).toHaveCount(0);
});

/**
 * Races, the third type the aside can render.
 *
 * Written against whatever race the chapter links to first rather than a named
 * one, so it survives the corpus shifting underneath it. What is being asserted
 * is the wiring, not which race MPMM happens to list first.
 */
test("opens a race from the chapter, summarised", async ({ page }) => {
  await page.goto("/sources/mpmm/fantastical-races");
  await expectHydrated(page);

  const link = page.locator('a[href^="/compendium/races/"]').first();
  const name = (await link.textContent())?.trim();

  await link.click();

  await expect(page.locator(`${ASIDE} h1`)).toHaveText(name!);
  await expect(page).toHaveURL(/\/sources\/mpmm\/fantastical-races$/);

  // Summarised, not the race page in a column: the named traits and any
  // subraces stay behind the link out.
  const aside = page.locator(ASIDE);
  await expect(aside.getByRole("link", { name: /full page/i })).toBeVisible();
  await expect(aside.locator("details")).toHaveCount(0);
});

/**
 * A deep link into a chapter section — the other half of what `FragmentTarget`
 * fixes, and the larger half.
 *
 * The subrace case in `races.e2e.ts` covers a target inside a `<details>`,
 * where a disclosure has to be opened before there is anywhere to scroll. This
 * is the plain one: a section in a 21,576px chapter, where nothing was standing
 * in for the browser at all. Measured 2026-08-10 before the fix, this landed at
 * the top of the page with the target 9,573px below it — the chapter routes
 * stream a fallback and the browser had scrolled against that.
 */
test("a deep link into a chapter section scrolls to it", async ({ page }) => {
  await page.goto("/sources/phb/combat#making-an-attack");
  await expectHydrated(page);

  await expectInView(page, "making-an-attack");
});
