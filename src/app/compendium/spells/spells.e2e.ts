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
 * The browse aside.
 *
 * This is the product's central interaction and the only part of it that no
 * cheaper tier can see. Clicking a row calls a server function and drops the
 * spell it renders into the panel beside the list — the list is never
 * unmounted, so scroll position and filters survive, and the URL never moves,
 * so the history stack is left alone.
 *
 * That last part is the reason this stopped being an intercepting route. Under
 * the old design every open pushed an entry, so reading five spells took five
 * back presses to escape and "close" re-opened the fourth. The history test
 * below is the regression guard for exactly that.
 *
 * Deliberately few tests. Filtering, paging, sorting and the table's contents
 * are all asserted where they are cheap — the filter hrefs in the component
 * tests, the narrowing in the query smoke test — and repeating any of that here
 * would buy nothing but minutes.
 */

const SPELLS = "/compendium/spells";

/** Narrow enough that the result is a single page, so paging cannot interfere. */
const NINTH_LEVEL = `${SPELLS}?level=9`;

/** Seven condition tags in its own text — the densest spell for references. */
const AURA_OF_PURITY = `${SPELLS}/phb/aura-of-purity`;

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
  await expect(page.locator("tbody[data-witness]")).toHaveCount(1);
  await expect(page.locator(ROWS)).toHaveCount(before);

  // The spell arrives as rendered markup from the server, not as a client
  // render of fetched JSON, so the panel carries its own heading.
  await expect(page.locator(`${ASIDE} h1`)).toBeVisible();
});

/**
 * The URL is the list's, and stays the list's. The spell is reachable at its
 * own address — that route still exists and every `{@spell}` tag resolves to
 * it — but reading one in the aside is not a navigation and must not look like
 * one to the browser.
 */
test("leaves the list's URL and filters alone while a spell is open", async ({
  page,
}) => {
  await page.goto(NINTH_LEVEL);
  await expectHydrated(page);
  const filtered = await page.locator(ROWS).count();

  await page.locator(`${ROWS} a`).first().click();
  await expect(page.locator(ASIDE)).toBeVisible();

  await expect(page).toHaveURL(new RegExp(`${SPELLS}\\?level=9$`));
  await expect(page.locator(ROWS)).toHaveCount(filtered);
});

/**
 * The bug that caused the rewrite. Reading several spells used to push an entry
 * each, burying the list under its own history.
 */
test("adds no history however many spells are read", async ({ page }) => {
  await page.goto(SPELLS);
  await expectHydrated(page);

  const depth = () => page.evaluate(() => history.length);
  const before = await depth();

  for (const index of [0, 1, 2]) {
    await page.locator(`${ROWS} a`).nth(index).click();
    await expect(page.locator(`${ASIDE} h1`)).toBeVisible();
  }

  expect(await depth()).toBe(before);
});

test("closes on Escape and on the close button, list intact", async ({
  page,
}) => {
  await page.goto(NINTH_LEVEL);
  await expectHydrated(page);
  const filtered = await page.locator(ROWS).count();

  await page.locator(`${ROWS} a`).first().click();
  await expect(page.locator(ASIDE)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(ASIDE)).toHaveCount(0);

  await page.locator(`${ROWS} a`).first().click();
  await expect(page.locator(ASIDE)).toBeVisible();

  await page.getByRole("button", { name: /close/i }).click();
  await expect(page.locator(ASIDE)).toHaveCount(0);

  await expect(page).toHaveURL(new RegExp(`${SPELLS}\\?level=9$`));
  await expect(page.locator(ROWS)).toHaveCount(filtered);
});

/**
 * Browsing is a scrolling task, and an open that jumps the list back to the top
 * loses the reader's place. Under the intercepting route this took a
 * `scroll={false}` on every row link to hold; now that opening is not a
 * navigation there is nothing to reset it, which is worth pinning down.
 */
test("holds the list's scroll position when a spell opens", async ({
  page,
}) => {
  await page.goto(SPELLS);
  await expectHydrated(page);

  await page.evaluate(() => window.scrollTo(0, 600));
  const before = await page.evaluate(() => window.scrollY);

  // Clicked in the page: Playwright would scroll the row into view first and
  // so measure its own scrolling rather than the product's.
  await page.evaluate(() => {
    const row = document.querySelectorAll<HTMLElement>(`tbody tr a`)[4];
    row?.click();
  });
  await expect(page.locator(`${ASIDE} h1`)).toBeVisible();

  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

/**
 * The section's layout is shared with each spell's own page, so the provider
 * holding the aside survives a navigation onto one. Without an explicit close
 * the full page arrives with the same spell still stacked beside it — which is
 * what the intercepting route's `default.tsx` used to prevent for free.
 */
test("closes when navigating out to the full page", async ({ page }) => {
  await page.goto(SPELLS);
  await expectHydrated(page);

  await page.locator(`${ROWS} a`).first().click();
  await expect(page.locator(`${ASIDE} h1`)).toBeVisible();

  await page.getByRole("link", { name: /open full page/i }).click();

  await expect(page).toHaveURL(/\/compendium\/spells\/[^/]+\/[^/]+$/);
  await expect(page.locator(ASIDE)).toHaveCount(0);
  await expect(page.locator("h1")).toBeVisible();
});

/** The open row is tinted through `:has()`, which only a browser resolves. */
test("marks the open row as current", async ({ page }) => {
  await page.goto(SPELLS);
  await expectHydrated(page);

  const second = page.locator(`${ROWS} a`).nth(1);
  await second.click();
  await expect(page.locator(ASIDE)).toBeVisible();

  await expect(second).toHaveAttribute("aria-current", "true");
  await expect(page.locator(`${ROWS} a[aria-current]`)).toHaveCount(1);
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
  const railMini = page.locator("[data-rail-mini]");

  await expect(optional).toBeVisible();
  await expect(railWide).toBeVisible();
  await expect(railMini).toBeHidden();

  await page.locator(`${ROWS} a`).first().click();
  await expect(page.locator(ASIDE)).toBeVisible();

  await expect(optional).toBeHidden();
  await expect(railWide).toBeHidden();
  await expect(railMini).toBeVisible();
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

/**
 * Searching twice without clearing in between.
 *
 * `q` is in every faceted list's `FILTER_KEYS`, so it reached `ListToolbar` as
 * a carried key and was written as a hidden input beside the search field
 * itself. The browser submitted both: a second search gave `?q=fire&q=acid`,
 * and since `readString` takes the first value, every search after the first
 * returned the first one's results. Only a real form submission shows it —
 * jsdom pins the markup, the browser pins what it does with it.
 */
test("a second search replaces the first rather than joining it", async ({
  page,
}) => {
  await page.goto(SPELLS);
  await expectHydrated(page);

  const search = page.getByRole("searchbox", { name: /search spells/i });

  await search.fill("fire");
  await search.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${SPELLS}\\?q=fire$`));
  const first = await page.locator(`${ROWS} a`).first().textContent();

  await search.fill("acid");
  await search.press("Enter");

  // One `q`, carrying the new term — not `?q=fire&q=acid`.
  await expect(page).toHaveURL(new RegExp(`${SPELLS}\\?q=acid$`));
  await expect(page.locator(`${ROWS} a`).first()).not.toHaveText(first ?? "");
  await expect(page.locator(`${ROWS} a`).first()).toHaveText(/acid/i);
});

/**
 * A spell's own text cites conditions and creatures — Aura of Purity names
 * seven conditions — and following one used to leave the spell. They open
 * beside it instead.
 *
 * The spell page had an aside slot in its layout for months and never wrapped
 * its body in `AsideLinks`, so every one of these navigated: to a 404 for a
 * type with no page, and to a lost place for a type with one. The URL assertion
 * is the half that catches a regression, since a link that navigates correctly
 * still looks right on screen.
 */
test("opens a condition cited by a spell without leaving the spell", async ({
  page,
}) => {
  await page.goto(AURA_OF_PURITY);
  await expectHydrated(page);

  const link = page.locator('a[href^="/compendium/conditions/"]').first();
  const name = (await link.textContent())?.trim();
  await link.click();

  // Matched loosely on case: book text writes "{@condition blinded}" in the
  // middle of a sentence, so the link reads "blinded" and the entity is
  // "Blinded".
  await expect(page.locator(ASIDE).locator("h1")).toHaveText(
    new RegExp(`^${name}$`, "i"),
  );
  await expect(page).toHaveURL(new RegExp(`${AURA_OF_PURITY}$`));
});
