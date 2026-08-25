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
