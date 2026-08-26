import { expect, test } from "@playwright/test";
import { ASIDE, ROWS, expectHydrated } from "@/test/e2e-helpers";

/**
 * The way out of the panel and onto the creature's own page.
 *
 * Creatures were the largest body of content with no page behind them, so the
 * aside was the whole of what a reader got. Now it is a preview, and this is
 * the link that says so — the only route to a shareable URL for what is open,
 * since opening an entity never moves the address bar.
 *
 * `Open full page →` carries `data-aside-ignore` precisely because the wrapper
 * around the panel would otherwise claim the click and reopen what is already
 * showing. Only a browser can prove the opt-out still works.
 */

const MONSTERS = "/compendium/monsters";

test("opens a creature's full page from the aside", async ({ page }) => {
  await page.goto(MONSTERS);
  await expectHydrated(page);

  await page.locator(`${ROWS} a`).first().click();
  await expect(page.locator(`${ASIDE} h1`)).toBeVisible();

  await page.getByRole("link", { name: /open full page/i }).click();

  await expect(page).toHaveURL(/\/compendium\/monsters\/[^/]+\/[^/]+$/);
  await expect(page.locator(ASIDE)).toHaveCount(0);
  await expect(page.locator("h1")).toBeVisible();
});

/**
 * The page prints the name once. The stat block prints it too in the panel,
 * where it owns the identity, and letting it do so here as well would put two
 * `h1`s on one document — the exact bug `density` exists to prevent.
 */
test("prints one heading and leads with the numbers", async ({ page }) => {
  await page.goto(`${MONSTERS}/mm/goblin`);
  await expectHydrated(page);

  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator("main h1")).toHaveText("Goblin");

  // The block, above whatever lore the creature carries.
  const block = page.getByText("Armor Class").first();
  await expect(block).toBeVisible();
});
