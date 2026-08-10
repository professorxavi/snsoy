import { expect, test } from "@playwright/test";
import { ASIDE, expectHydrated } from "@/test/e2e-helpers";

/**
 * Search's browser-only risks.
 *
 * Ranking is not among them — that is a claim about 12,851 real rows and is
 * pinned in `search.smoke.test.ts`, where a regression names the entity it
 * broke. What is left here is the wiring, and all of it is invisible below the
 * browser:
 *
 * - The top bar's form is the only entry point to this route, and it is a plain
 *   GET whose action, method and field name have to agree with what the page
 *   reads back out of the URL. Nothing else in the suite submits it.
 * - A result list is heterogeneous — a spell, a chapter and a class feature in
 *   consecutive rows — and each row binds `openEntityAside` for its own type.
 *   The action returns rendered JSX, so a type wired wrong fails at reply time
 *   with `tsc`, the whole Vitest suite and `next build` all green.
 * - Opening a result must not cost the query. It lives only in the URL, and the
 *   aside is client state; the point of the panel is that a reader can try nine
 *   candidates and still have their search.
 */

/**
 * The typeahead, end to end: the top bar, a real request to the route handler,
 * and the aside opening on arrival. Three pieces that only meet in a browser —
 * the component test stubs `fetch`, and the endpoint's own test never renders
 * anything.
 *
 * A creature is the case worth driving. It has no page of its own, so the
 * dropdown's whole promise — pick "Goblin", see the goblin — rests on the
 * results page reading `open` out of the URL and opening the panel itself.
 */
test("picking a creature from the typeahead shows its stat block", async ({
  page,
}) => {
  await page.goto("/");
  await expectHydrated(page);

  await page.getByRole("combobox").fill("goblin");

  /*
   * The creature specifically. "Goblin" is also a race in five books, and the
   * two tie on prominence — which is why the dropdown prints the kind against
   * every row, and why this picks by it rather than by name.
   */
  const option = page.getByRole("option").filter({ hasText: "Creature" }).first();
  await expect(option).toBeVisible();
  await option.click();

  await expect(page).toHaveURL(/\/search\?q=Goblin&open=monster%3Amm%3Agoblin/);
  await expect(page.locator(`${ASIDE} h1`)).toHaveText("Goblin");
});

/**
 * `open` is an arrival instruction, not filter state. If it survived into the
 * links the page builds, closing the panel and clicking a facet would reopen
 * the same entity — and the reader would have no way to dismiss it at all.
 */
test("the pre-opened entity does not come back when a facet is clicked", async ({
  page,
}) => {
  await page.goto("/search?q=Goblin&open=monster:mm:goblin");
  await expectHydrated(page);
  await expect(page.locator(`${ASIDE} h1`)).toHaveText("Goblin");

  await page.locator(`${ASIDE}`).getByRole("button", { name: /Close/ }).click();
  await expect(page.locator(ASIDE)).toHaveCount(0);

  await page.getByRole("link", { name: /^Creature/ }).first().click();

  await expect(page).toHaveURL(/type=monster/);
  await expect(page).not.toHaveURL(/open=/);
  await expect(page.locator(ASIDE)).toHaveCount(0);
});

/** Enter with nothing highlighted is the form's own submit, as it always was. */
test("Enter without choosing a suggestion still searches", async ({ page }) => {
  await page.goto("/");
  await expectHydrated(page);

  await page.getByRole("combobox").fill("fireball");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/search\?q=fireball$/);
});

test("the top bar's box reaches the results", async ({ page }) => {
  await page.goto("/");
  await expectHydrated(page);

  await page.getByLabel("Search the compendium").fill("fireball");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/search\?q=fireball$/);
  // The spell everyone means, first. Ranking is asserted properly against the
  // seed; what this pins is that the query survived the trip through the form.
  await expect(page.getByRole("listitem").first()).toContainText("Fireball");
});

/**
 * Three types that reach the aside by three different `case` branches, and a
 * fourth that has no renderer and must still navigate. One query returns all
 * four, which is the situation no browse list can produce.
 */
test("opens results of different types in the aside, keeping the query", async ({
  page,
}) => {
  await page.goto("/search?q=fire");
  await expectHydrated(page);

  const url = page.url();

  for (const kind of ["Spell", "Creature", "Magic Item"]) {
    const row = page
      .getByRole("listitem")
      .filter({ hasText: kind })
      .first();
    await row.scrollIntoViewIfNeeded();
    await row.getByRole("link").first().click();

    // A heading proves the reply was rendered markup from the server rather
    // than an error boundary or an empty panel.
    await expect(page.locator(`${ASIDE} h1`)).toBeVisible();
    await expect(page).toHaveURL(url);
  }
});

/**
 * Reading nine candidates must leave the history stack where it found it, or
 * the back button no longer returns to wherever the search came from. This is
 * the property the whole aside mechanism exists to keep, and the only place it
 * can be observed.
 */
test("opening results does not grow the history stack", async ({ page }) => {
  await page.goto("/search?q=fire");
  await expectHydrated(page);

  const before = await page.evaluate(() => history.length);

  /*
   * Names are collected before the first click, and each row is then addressed
   * by name rather than by position. Opening the aside collapses the rail and
   * drops the optional column, so every row moves — an index resolved after
   * that lands on a different row, or on one Playwright is still watching move.
   */
  const names = await page
    .getByRole("listitem")
    .locator("a[data-aside-open]")
    .evaluateAll((links) => links.slice(0, 3).map((link) => link.textContent!));

  expect(names.length).toBe(3);

  for (const name of names) {
    await page.getByRole("link", { name, exact: true }).first().click();
    await expect(page.locator(`${ASIDE} h1`)).toBeVisible();
  }

  await expect(page.locator(ASIDE)).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(before);
});

/**
 * The type facet is a link, not a control, so it survives without JavaScript —
 * but it must carry the query with it. `clearAll` keeps `sort` by default,
 * which for this route would have discarded the one thing on the page nobody
 * can retype from memory.
 */
test("filtering by kind keeps the query", async ({ page }) => {
  await page.goto("/search?q=fire");
  await expectHydrated(page);

  await page.getByRole("link", { name: /^Spell/ }).first().click();

  await expect(page).toHaveURL(/q=fire/);
  await expect(page).toHaveURL(/type=spell/);
  await expect(page.getByRole("link", { name: "Clear filters" })).toBeVisible();

  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/search\?q=fire$/);
});
