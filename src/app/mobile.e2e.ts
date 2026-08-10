import { expect, test } from "@playwright/test";
import { RAIL, expectHydrated } from "@/test/e2e-helpers";

/**
 * The app at a phone's width.
 *
 * The rest of this suite runs at 1440px, deliberately — every layout assertion
 * in it is about the rail, the outline or the aside, all of which live above
 * `lg`. That left the two things below it uncovered, and both were broken: the
 * bar's nav is `display: none` under `md` with nothing replacing it, and the
 * filter rail is `display: none` under `lg`, so no list in the compendium could
 * be filtered on a phone at all.
 *
 * Neither failure is visible to a cheaper tier. Both are a media query deciding
 * that an element which is present, rendered and correct in the markup is not
 * shown — which is exactly the class of bug only a browser can see.
 */

test.use({ viewport: { width: 375, height: 812 } });

test("reaches the compendium through the nav drawer", async ({ page }) => {
  await page.goto("/");
  await expectHydrated(page);

  // The premise: at this width the bar's own nav is not an option.
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();

  await page.getByRole("button", { name: "Menu" }).click();

  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Compendium" }).click();

  await expect(page).toHaveURL(/\/compendium$/);
});

test("filters a list from the sheet", async ({ page }) => {
  await page.goto("/compendium/spells");
  await expectHydrated(page);

  const rail = page.locator(RAIL);
  await expect(rail).toBeHidden();

  await page.getByRole("button", { name: "Filters" }).click();
  await expect(rail).toBeVisible();

  /*
   * The sheet holds the real rail, not a copy of it — so the option is the same
   * link it is on the desktop layout, and following it is an ordinary
   * navigation. Its accessible name carries the facet count after the label.
   */
  await rail.getByRole("link", { name: /^Evocation/ }).click();

  await expect(page).toHaveURL(/school=/);
  await expect(page.locator("tbody tr").first()).toBeVisible();
});
