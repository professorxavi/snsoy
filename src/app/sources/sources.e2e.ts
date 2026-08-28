import { expect, test } from "@playwright/test";
import {
  ASIDE,
  expectHydrated,
  expectInView,
  expectNodeHydrated,
} from "@/test/e2e-helpers";

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
 * One page carries it. Every table in the books goes through one renderer, and
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
 * A wide table reaches past the measure, and never past the column.
 *
 * This has been decided twice. Reaching into the margins was tried and pulled
 * back once, because a table half again the width of the prose was conspicuous
 * in a layout whose whole point is one measured column. The table plan re-takes
 * it deliberately: a wide table is a figure rather than a paragraph, and
 * holding one to 68 characters was costing Wilderness Encounters a third of its
 * columns and the Sorcerer's feature names two type sizes.
 *
 * What makes it safe this time is the cap and the centring. The width comes
 * from `--table-room`, which the reading column derives from its own `main`, so
 * it can reach into the margins either side and never into the outline gutter.
 */
test("lets a wide table reach past the measure, but not past the column", async ({
  page,
}) => {
  await page.goto(CLASSES);
  await expectHydrated(page);

  // A paragraph on the same page is the measure, measured rather than assumed.
  const paragraph = (await page.locator("p.prose").first().boundingBox())!;

  const { container, main } = await page
    .locator("[data-table-profile] table")
    .first()
    .evaluate((el) => {
      const box = el.closest("div")!.getBoundingClientRect();
      const region = document.querySelector("main#main")!;
      const style = getComputedStyle(region);
      const rect = region.getBoundingClientRect();
      return {
        container: { x: box.x, right: box.right, width: box.width },
        main: {
          left: rect.left + parseFloat(style.paddingLeft),
          right: rect.right - parseFloat(style.paddingRight),
        },
      };
    });

  expect(container.width).toBeGreaterThan(paragraph.width);
  // Inside the column's own padding, so the outline gutter is never crossed.
  expect(container.x).toBeGreaterThanOrEqual(main.left - 1);
  expect(container.right).toBeLessThanOrEqual(main.right + 1);

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);
});

/**
 * Whatever does not fit is still reachable — and on a narrow screen the
 * Sorcerer's thirteen columns never will.
 *
 * At the desktop viewport the progression now fits the column it was given, so
 * the case worth pinning has moved to the phone. What must hold is that the
 * columns are reached by scrolling the table rather than by losing them, and
 * that the page itself never scrolls sideways to offer them.
 */
test("leaves an over-wide table scrollable rather than clipped", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/compendium/classes/phb/sorcerer");
  await expectHydrated(page);

  const box = await page.evaluate(() => {
    const table = document.querySelector("main table");
    const wrap = table?.closest("div");
    if (!wrap) return null;

    wrap.scrollLeft = wrap.scrollWidth;
    return {
      overflows: wrap.scrollWidth > wrap.clientWidth,
      canScroll: getComputedStyle(wrap).overflowX,
      // Nothing left unreachable once scrolled to the end.
      unreached: wrap.scrollWidth - wrap.clientWidth - wrap.scrollLeft,
      page:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });

  expect(box?.overflows).toBe(true);
  expect(box?.canScroll).toBe("auto");
  expect(box?.unreached).toBe(0);
  expect(box?.page).toBe(0);
});

/**
 * Opening an entity from the prose.
 *
 * A chapter is dense with cross-references — 36,000 across the books — and
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

  // This link, not merely the page: a chapter hydrates progressively, and a
  // click that lands first navigates instead of opening the panel.
  await expectNodeHydrated(page, 'a[href^="/compendium/classes/"]');
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
 * There used to be a case here for a link the aside cannot render, asserting it
 * navigated exactly as it had before the wrapper existed. It cited creatures,
 * then items, then actions, then deities, then vehicles, and each was retired
 * as its renderer landed — and with the vehicles there is nothing left to
 * stand in it. The guard is still in `AsideLinks`; what makes it unreachable is
 * pinned in `aside.test.ts` instead.
 *
 * These two took its place, and they are the same assertion from the other
 * side. Both exercise the inbound-link path — a tag in a chapter, not a row in
 * a list — which is the one that was broken.
 */
test("opens a vehicle from the chapter that sails it", async ({ page }) => {
  await page.goto("/sources/lox/chaos-in-doomspace");
  await expectHydrated(page);

  const link = page.locator('a[href^="/compendium/vehicles/"]').first();
  test.skip((await link.count()) === 0, "no vehicle links in this chapter");

  const name = (await link.textContent())?.trim() ?? "";
  await link.scrollIntoViewIfNeeded();
  await link.click();

  // A vehicle has no page, so the panel is the whole of what is shown — and it
  // must carry the stat block, not just the name: 33 of the 35 have no prose.
  await expect(page.locator(`${ASIDE} h1`)).toHaveText(new RegExp(name, "i"));
  await expect(page.locator(ASIDE).getByText("Creature Capacity")).toBeVisible();
});

/**
 * The card fix, from the reader's side.
 *
 * A card's natural key carries its deck — `card|abjurer|tarokka deck|cos` — and
 * `{@card}` was read as though the deck were a source, so all 545 of these tags
 * resolved to nothing and rendered as plain words. This chapter alone carries
 * 89 of them.
 */
test("opens a card from a chapter that deals it", async ({ page }) => {
  await page.goto("/sources/cos/the-tarokka-deck");
  await expectHydrated(page);

  const link = page.locator('a[href^="/compendium/cards/"]').first();
  await expect(link).toBeVisible();

  const name = (await link.textContent())?.trim() ?? "";
  await link.scrollIntoViewIfNeeded();
  await link.click();

  await expect(page.locator(`${ASIDE} h1`)).toHaveText(new RegExp(name, "i"));
});

/**
 * Races, the third type the aside can render.
 *
 * Written against whatever race the chapter links to first rather than a named
 * one, so it survives the books shifting underneath it. What is being asserted
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

/**
 * A long lookup table keeps its headings without being put in a box.
 *
 * A table of 113 rows is arrived at with a number, and by the time you find the
 * row the headings are far above it. Bounding the table would fix that and cost
 * the chapter a nested scroller in the middle of its prose, so the headings
 * stick to the page instead, under the top bar.
 *
 * This only works because the table has no horizontal wrapper. `overflow-x:
 * auto` makes a box scroll in the block axis too, and a heading inside one
 * holds against that box rather than the page — so the absence of the wrapper
 * is half of the behaviour, and is asserted with it.
 */
const PINEBROOK = "/sources/pip/peril-in-pinebrook";

test("holds a long table's headings against the page as it scrolls", async ({
  page,
}) => {
  await page.goto(PINEBROOK);
  await expectHydrated(page);

  const frame = page
    .locator("[data-table-profile]")
    .filter({ has: page.locator("tbody tr:nth-child(100)") })
    .first();

  // No wrapper, so the page is the only thing that scrolls around it.
  await expect(frame.locator("[data-table-scroll]")).toHaveCount(0);

  const heading = frame.locator("thead th").first();
  await heading.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(150);

  const box = await heading.boundingBox();
  const bar = await page.locator("header").first().boundingBox();

  // Still on screen, and resting on the bar rather than under it.
  expect(box!.y).toBeGreaterThanOrEqual(bar!.height - 1);
  expect(box!.y).toBeLessThan(bar!.height + 8);
});

/**
 * A scroll region is named after the heading a reader can see above it.
 *
 * The word-search grid has no caption and no column headings, so its name can
 * only come from the section it sits in — and the chapter page draws that
 * heading itself, which is how the name came to be the chapter's rather than
 * the section's. Only a browser shows it, because the name is applied when the
 * region turns out to overflow.
 */
test("names an uncaptioned region after the section it is printed under", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sources/awm/activity-pages");
  await expectHydrated(page);

  await expect(page.getByRole("region", { name: "Word Find table" })).toHaveCount(
    1,
  );

  // And the nearer name wins without displacing the others on the page.
  const named = await page
    .locator("[data-table-scroll]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-table-label")),
    );
  expect(new Set(named).size).toBe(named.length);
});
