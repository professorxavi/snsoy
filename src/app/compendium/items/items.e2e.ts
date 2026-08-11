import { expect, test } from "@playwright/test";
import {
  ASIDE,
  ROWS,
  expectHydrated,
  expectNodeHydrated,
} from "@/test/e2e-helpers";

/**
 * The item list's one browser-only risk: three entity types, one action.
 *
 * Everything else about this view is asserted where it is cheap. The aside
 * mechanism — no unmount, no URL change, no history, Escape, the rail collapse,
 * the full-height columns — belongs to shared components and is already pinned
 * against them in `spells.e2e.ts`; repeating it here would buy minutes and
 * nothing else. Filtering, sorting, paging and every column's contents are
 * answered by the query smoke test and the component tests.
 *
 * What is left is specific to this slice and invisible below the browser. Three
 * entity types share one action, each a separate `case` in `openEntityAside`,
 * and the action returns rendered JSX rather than JSON — so a type wired wrong
 * fails at reply time, in the browser, with `tsc`, the whole Vitest suite and
 * `next build` all green.
 *
 * Two of the three are reached from the list. `itemGroup` is not browsed at
 * all — see `BROWSED_ITEM_TYPES` — so it is exercised the only way a reader
 * meets one, from a chapter that cites it, which is also the regression that
 * dropping it from the list most risks.
 */

const ITEMS = "/compendium/items";

/** One row of each browsable type, reached by the category filter the rail writes. */
const CATEGORIES = [
  { category: "item", label: "a magic item" },
  { category: "baseitem", label: "a piece of equipment" },
];

for (const { category, label } of CATEGORIES) {
  test(`opens ${label} in the aside`, async ({ page }) => {
    await page.goto(`${ITEMS}?category=${category}`);
    await expectHydrated(page);

    await page.locator(`${ROWS} a`).first().click();

    // The heading proves the reply was rendered markup from the server rather
    // than an error boundary or an empty panel.
    await expect(page.locator(`${ASIDE} h1`)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`\\?category=${category}$`));
  });
}

/**
 * The payoff for the whole slice: 8,182 `{@item}` references in book text were
 * dead links, and they now open beside the prose they were met in. The reader's
 * links are caught in the capture phase — a `next/link` has already started
 * navigating by the time a bubble handler runs — so this is only observable in
 * a browser, and only for types listed in `ASIDE_TYPES`.
 */
test("opens an item cited in a chapter without leaving the chapter", async ({
  page,
}) => {
  await page.goto("/sources/dmg/treasure");
  await expectHydrated(page);

  const url = page.url();
  const selector = 'a[href^="/compendium/items/"]';

  /*
   * This link, not merely the page. A chapter is long and hydrates
   * progressively, so `expectHydrated` can return while the anchor here is
   * still server markup — and clicking it then navigates, because the handler
   * that would have opened the aside is not attached yet.
   */
  await expectNodeHydrated(page, selector);

  const link = page.locator(selector).first();
  await link.scrollIntoViewIfNeeded();
  await link.click();

  await expect(page.locator(`${ASIDE} h1`)).toBeVisible();
  await expect(page).toHaveURL(url);
});

/**
 * The group, from the only place a reader now meets one.
 *
 * `/compendium/items` no longer lists the 73 groups, but 386 `{@item}`
 * references still resolve to one and every one of them must still open. The
 * DMG's treasure chapter cites twelve.
 */
test("opens an item group cited in a chapter", async ({ page }) => {
  await page.goto("/sources/dmg/treasure");
  await expectHydrated(page);

  const url = page.url();
  const selector = 'a[href^="/compendium/item-groups/"]';
  await expectNodeHydrated(page, selector);

  const link = page.locator(selector).first();
  const name = (await link.textContent())?.trim() ?? "";
  await link.scrollIntoViewIfNeeded();
  await link.click();

  await expect(page.locator(`${ASIDE} h1`)).toHaveText(new RegExp(name, "i"));
  await expect(page).toHaveURL(url);
});
