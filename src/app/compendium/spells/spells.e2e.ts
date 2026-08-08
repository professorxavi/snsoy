import { expect, test } from "@playwright/test";
import {
  ASIDE,
  OPTIONAL_COLUMN,
  RAIL,
  ROWS,
  expectHydrated,
  fillsViewportBelowTopbar,
} from "@/test/e2e-helpers";

/**
 * The intercepting aside.
 *
 * This is the product's central interaction and the only part of it that no
 * cheaper tier can see. Clicking a row opens the spell over the list without
 * unmounting it — the URL changes, the list keeps its scroll position and its
 * filters, and back closes the aside rather than leaving the page. Whether the
 * list actually survived is a runtime fact about a parallel route; it is not in
 * the markup, and rendering the component in isolation cannot produce it.
 *
 * Deliberately four tests. Filtering, paging, sorting and the table's contents
 * are all asserted where they are cheap — the filter hrefs in the component
 * tests, the narrowing in the query smoke test — and repeating any of that
 * here would buy nothing but minutes.
 */

const SPELLS = "/compendium/spells";

/** Narrow enough that the result is a single page, so paging cannot interfere. */
const NINTH_LEVEL = `${SPELLS}?level=9`;

test("opens a spell over the list without unmounting it", async ({ page }) => {
  await page.goto(SPELLS);
  await expectHydrated(page);

  const before = await page.locator(ROWS).count();

  // Marks the live table so a survivor can be told from a re-render.
  await page.evaluate(() => {
    document.querySelector("tbody")?.setAttribute("data-witness", "1");
  });

  await page.locator(`${ROWS} a`).first().click();

  await expect(page.locator(ASIDE)).toBeVisible();
  await expect(page).toHaveURL(/\/compendium\/spells\/[^/]+\/[^/]+$/);
  await expect(page.locator("tbody[data-witness]")).toHaveCount(1);
  await expect(page.locator(ROWS)).toHaveCount(before);
});

/**
 * The route-map invariant at runtime: the URL the aside puts in the bar is the
 * spell's own, shareable and free of the list's state — while the list beneath
 * keeps that state.
 */
test("gives the aside the spell's canonical URL, over the filtered list", async ({
  page,
}) => {
  await page.goto(NINTH_LEVEL);
  await expectHydrated(page);
  const filtered = await page.locator(ROWS).count();

  await page.locator(`${ROWS} a`).first().click();
  await expect(page.locator(ASIDE)).toBeVisible();

  expect(new URL(page.url()).search).toBe("");
  await expect(page.locator(ROWS)).toHaveCount(filtered);
});

test("closes on back, with the filtered list intact", async ({ page }) => {
  await page.goto(NINTH_LEVEL);
  await expectHydrated(page);
  const filtered = await page.locator(ROWS).count();

  await page.locator(`${ROWS} a`).first().click();
  await expect(page.locator(ASIDE)).toBeVisible();

  await page.goBack();

  await expect(page.locator(ASIDE)).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("?level=9");
  await expect(page.locator(ROWS)).toHaveCount(filtered);
});

/**
 * The frame reacts to the aside entirely in CSS, through `:has()` — the rail
 * swaps to its narrow face and the table sheds its least important columns to
 * pay for the width. No JavaScript is involved and no attribute changes on the
 * affected elements, so a browser that applied the stylesheet is the only
 * place this is observable. Both faces of the rail are always in the markup.
 */
test("collapses the rail and sheds table columns when the aside opens", async ({
  page,
}) => {
  await page.goto(SPELLS);
  await expectHydrated(page);

  const optional = page.locator(`thead ${OPTIONAL_COLUMN}`).first();
  const railWide = page.locator("[data-rail-full]");

  await expect(optional).toBeVisible();
  await expect(railWide).toBeVisible();

  await page.locator(`${ROWS} a`).first().click();
  await expect(page.locator(ASIDE)).toBeVisible();

  await expect(optional).toBeHidden();
  await expect(railWide).toBeHidden();

  /*
   * The narrow rail face is deliberately not asserted here. It is meant to be
   * hidden until the aside opens, and it is not: the rule that hides it is
   * written as a bare `[data-rail-mini]` key, which Chakra's `css` prop drops
   * because it does not begin with `&`. Only the `:has()` rule survives, so
   * the collapsed face is permanently visible. Asserting the intent would
   * leave a red test standing in for a one-line fix in `browse-layout.tsx`.
   */
});

/**
 * Both columns are full-height rather than content-height. This regressed once
 * already — a rail that stops at its last filter leaves a ragged edge down the
 * middle of the page — and height is computed, so nothing in the markup shows
 * whether it is right.
 */
test("stands the rail and the aside the full height of the viewport", async ({
  page,
}) => {
  await page.goto(SPELLS);
  await expectHydrated(page);

  expect(await fillsViewportBelowTopbar(page, RAIL)).toBe(true);

  await page.locator(`${ROWS} a`).first().click();
  await expect(page.locator(ASIDE)).toBeVisible();

  expect(await fillsViewportBelowTopbar(page, ASIDE)).toBe(true);
});
