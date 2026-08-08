import { expect, test } from "@playwright/test";
import {
  OUTLINE,
  expectHydrated,
  isDisclosureOpen,
  isInView,
} from "@/test/e2e-helpers";

/**
 * Deep links into a collapsed subrace.
 *
 * Roughly 93 links from book text point at a subrace anchor, and every one of
 * them depends on a browser behaviour the markup only hints at: a fragment
 * expands a closed `<details>` when it targets the element's *contents*, and
 * does nothing when it targets the element itself. The anchor is therefore
 * placed inside the disclosure rather than on it.
 *
 * Move that `id` up one element and every inbound link still resolves, still
 * renders, and quietly lands the reader on a collapsed section. That is the
 * failure this file exists for, and it cannot be seen anywhere else — the
 * component test can prove the anchor is nested, but only a browser proves the
 * nesting has the effect it was chosen for.
 *
 * Whether `<details>` opens when its summary is clicked is not tested here.
 * That is the platform's contract, not this app's.
 */

const DWARF = "/compendium/races/phb/dwarf";
const TIEFLING = "/compendium/races/phb/tiefling";

/** A cold load with a fragment — what an inbound link from book text produces. */
test("a deep link opens the subrace and scrolls to it", async ({ page }) => {
  await page.goto(`${DWARF}#hill`);
  await expectHydrated(page);

  expect(await isDisclosureOpen(page, "hill")).toBe(true);
  expect(await isInView(page, "hill")).toBe(true);
});

/**
 * The same-document case: a hash change with no navigation, which the browser
 * handles by a different path than a cold load.
 */
test("an outline jump opens the subrace and scrolls to it", async ({
  page,
}) => {
  await page.goto(TIEFLING);
  await expectHydrated(page);

  const target = await page.evaluate((outline) => {
    const links = [
      ...document.querySelectorAll<HTMLAnchorElement>(`${outline} a[href^="#"]`),
    ];
    return links.at(-1)?.getAttribute("href")?.slice(1) ?? null;
  }, OUTLINE);

  expect(target).toBeTruthy();
  expect(await isDisclosureOpen(page, target!)).toBe(false);

  await page.locator(`${OUTLINE} a[href="#${target}"]`).click();

  expect(await isDisclosureOpen(page, target!)).toBe(true);
  expect(await isInView(page, target!)).toBe(true);
});

/**
 * The reading column's outline, checked once here rather than on every page
 * that uses it — `ReadingColumn` is shared, so a second copy of this test on
 * the chapter route would assert the same CSS twice.
 *
 * Position and placement are both computed. A sticky outline that has quietly
 * become static scrolls away on the long pages it exists to serve.
 */
test("keeps the outline sticky on the trailing edge", async ({ page }) => {
  await page.goto(TIEFLING);
  await expectHydrated(page);

  const outline = page.locator(OUTLINE);
  await expect(outline).toBeVisible();

  expect(
    await page.evaluate(
      (sel) => getComputedStyle(document.querySelector(sel)!).position,
      OUTLINE,
    ),
  ).toBe("sticky");

  const [nav, main] = await Promise.all([
    outline.boundingBox(),
    page.locator("main, [id=main]").first().boundingBox(),
  ]);
  expect(nav!.x).toBeGreaterThan(main!.x + main!.width - 40);

  // Still on screen at the foot of a long page, which is what sticky buys.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const after = await outline.boundingBox();
  expect(after!.y).toBeLessThan(900);
});
