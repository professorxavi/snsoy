import { expect, test } from "@playwright/test";
import { ASIDE, expectHydrated } from "@/test/e2e-helpers";

/**
 * References in class features open beside the page.
 *
 * Class features are the densest prose in the app for cross-references — 1,441
 * tags across the thirteen classes — and until this wrapper landed every one of
 * them navigated away from the class being read. The classes section had no
 * aside at all: no slot in any layout, and no `AsideLinks` on the page.
 *
 * Only a browser can see it. `AsideLinks` claims the click during the capture
 * phase specifically to beat `next/link`'s own handler, which calls
 * `router.push()` the moment it runs — a jsdom test can prove the wrapper is in
 * the tree but not that it wins the race against a real navigation.
 */

/** Six condition tags across its features, the most of any class. */
const BARBARIAN = "/compendium/classes/phb/barbarian";

test("opens a condition cited by a feature without leaving the class", async ({
  page,
}) => {
  await page.goto(BARBARIAN);
  await expectHydrated(page);

  const link = page.locator('a[href^="/compendium/conditions/"]').first();
  const name = (await link.textContent())?.trim();
  await link.click();

  // Matched loosely on case: book text writes "{@condition charmed}" mid
  // sentence, so the link reads "charmed" and the entity is "Charmed".
  await expect(page.locator(ASIDE).locator("h1")).toHaveText(
    new RegExp(`^${name}$`, "i"),
  );

  // The half that catches a regression: a link that navigates correctly still
  // looks right on screen, and only the URL says the reader lost their place.
  await expect(page).toHaveURL(new RegExp(`${BARBARIAN}$`));
});

/**
 * A progression is a whole thing, and stays one.
 *
 * Twenty levels are the arc of a class rather than a set of results to look
 * something up in, so the page keeps the vertical axis and the table is never
 * boxed. It is the one table in the app whose shape says otherwise — wide
 * enough and tall enough to be a two-axis matrix by every measure the
 * classifier takes — which is exactly why it needs a test rather than a rule.
 *
 * Only a browser can see it: `max-height` is a computed style, and whether
 * anything scrolls inside the frame is a fact about laid-out boxes.
 */
const SORCERER = "/compendium/classes/phb/sorcerer";

test("shows all twenty levels with nothing scrolling inside the table", async ({
  page,
}) => {
  await page.goto(SORCERER);
  await expectHydrated(page);

  const frame = page.locator("[data-table-profile]").first();
  await expect(frame.locator('tbody th[scope="row"]')).toHaveCount(20);
  await expect(frame.locator('tbody th[scope="row"]').first()).toHaveText("1st");
  await expect(frame.locator('tbody th[scope="row"]').last()).toHaveText("20th");

  const scroller = frame.locator("[data-table-scroll]");
  await expect(scroller).not.toHaveAttribute("data-table-bounded", /.*/);

  expect(
    await scroller.evaluate((node) => ({
      maxHeight: getComputedStyle(node).maxHeight,
      hidden: node.scrollHeight - node.clientHeight,
    })),
  ).toEqual({ maxHeight: "none", hidden: 0 });
});

/**
 * The level column holds while the spell slots pan past it.
 *
 * A row whose identity has scrolled off is a row of numbers with nothing to
 * attach them to, and the Sorcerer's twelve slot columns are far wider than a
 * phone. Pinning it needs the cell to be the row's heading, so the semantics
 * and the behaviour are one decision and are asserted together.
 */
test("keeps the level in view while panning across the spell slots", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SORCERER);
  await expectHydrated(page);

  const level = page
    .locator("[data-table-profile] tbody th[scope='row']")
    .first();
  const before = await level.boundingBox();

  await page
    .locator("[data-table-scroll]")
    .first()
    .evaluate((node) => node.scrollTo({ left: 400 }));

  const after = await level.boundingBox();
  expect(Math.round(after!.x)).toBe(Math.round(before!.x));

  // And the page itself never becomes the thing that scrolled.
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);
});

/**
 * Features is prose, and is given the room prose is given.
 *
 * It is the only column of sentences here and it had no floor at all, so it
 * took whatever the compact columns left — about 113px on a phone — and set
 * feature names three and four lines deep, which is the one thing a table that
 * must show all twenty levels at once cannot afford.
 */
test("holds the features column to the shared prose floor on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SORCERER);
  await expectHydrated(page);

  const measured = await page.evaluate(() => {
    const frame = document.querySelector("[data-table-profile]")!;
    const rows = [...frame.querySelectorAll("thead tr")];
    const heads = [...rows[rows.length - 1]!.children];
    const index = heads.findIndex((cell) => cell.textContent?.trim() === "Features");
    const body = frame.querySelector("tbody tr")!;
    const features = body.children[index]!;

    return {
      width: features.getBoundingClientRect().width,
      fontSize: getComputedStyle(features).fontSize,
      widestCompact: Math.max(
        ...[...body.children]
          .filter((_, at) => at !== index && at !== 0)
          .map((cell) => cell.getBoundingClientRect().width),
      ),
    };
  });

  // 12rem, as every other prose column in a table that reaches past the measure.
  expect(measured.width).toBeGreaterThanOrEqual(192);
  expect(measured.width).toBeGreaterThan(measured.widestCompact);
  expect(measured.fontSize).toBe("14px");
});
