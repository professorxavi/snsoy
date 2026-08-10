import { expect, test } from "@playwright/test";
import {
  ASIDE,
  OUTLINE,
  expectDisclosureOpen,
  expectHydrated,
  expectInView,
  isDisclosureOpen,
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

/**
 * A cold load with a fragment — what an inbound link from book text produces.
 *
 * The scroll half of this is `FragmentTarget`'s, not the browser's. The route
 * streams a `loading.tsx` fallback and the browser scrolls against *that*:
 * measured 2026-08-10, `#hill` resolves at ~145ms while the document is 726px
 * tall, and the real 4,663px body swaps in at ~373ms. Whatever the browser did
 * is lost by then.
 *
 * This passed for months on a technicality — it was the first file in the suite,
 * so its one request hit a cold server and the timings inverted. Anything that
 * runs before it warms the server and the page fails as it always did for a
 * real reader, which is how the bug surfaced.
 */
test("a deep link opens the subrace and scrolls to it", async ({ page }) => {
  await page.goto(`${DWARF}#hill`);
  await expectHydrated(page);

  await expectDisclosureOpen(page, "hill");
  await expectInView(page, "hill");
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

  await expectDisclosureOpen(page, target!);
  await expectInView(page, target!);
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

/**
 * A race's traits cite spells — a Duergar alone names four — and following one
 * used to leave the race you were reading. They open beside it instead.
 *
 * Driven through a subrace disclosure because that is where these links live,
 * and it is also the case a bubble-phase handler would miss: the anchor is
 * inside a `<details>` several levels below the wrapper.
 */
test("opens a spell cited by a trait without leaving the race", async ({
  page,
}) => {
  await page.goto(DWARF);
  await expectHydrated(page);

  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((d) => (d.open = true));
  });

  const link = page.locator('a[href^="/compendium/spells/"]').first();
  const name = (await link.textContent())?.trim();
  await link.click();

  await expect(page.locator(ASIDE).locator("h1")).toHaveText(name!);
  await expect(page).toHaveURL(new RegExp(`${DWARF}$`));
});

/**
 * The art stands in the margin rather than floating inside the column. It
 * floated until the flavour text was printed and the pages grew long; a
 * portrait in the measure then either strands a column of two-word lines beside
 * it or, for plates that are mostly transparent padding, pushes the opening
 * paragraphs down the page. Only a browser can see where it ended up.
 */
test("stands the illustration outside the reading measure", async ({ page }) => {
  await page.goto(DWARF);
  await expectHydrated(page);

  const art = page.locator("main img").first();
  await expect(art).toBeVisible();

  const image = (await art.boundingBox())!;
  const prose = (await page.locator("p.prose").first().boundingBox())!;

  // It begins out in the margin. Not *entirely* clear of the column — the
  // plate is deliberately wider than the margin and dissolves across the inner
  // edge — but it starts outside the measure rather than inside it.
  expect(image.x).toBeLessThan(prose.x);

  // And the prose runs alongside rather than being pushed below it, which is
  // what a float did once the pages grew long.
  expect(prose.y).toBeLessThan(image.y + image.height);

  // Reaching into the margin must not widen the document.
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);
});
