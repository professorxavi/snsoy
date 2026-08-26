import { expect, test } from "@playwright/test";
import { expectHydrated } from "@/test/e2e-helpers";

/**
 * The 404's signpost, which only a browser can see.
 *
 * The page is prerendered and the address is the whole input, so the served
 * HTML cannot contain the hint — it appears only once `usePathname` is readable,
 * which is after hydration. Every jsdom test of this mocks `usePathname` and so
 * proves the copy but never the timing.
 *
 * The failure mode is silence: get the hydration gate wrong and the hint simply
 * never renders, with `tsc`, eslint and the whole unit suite green.
 */

test("names the type for an address that has no page", async ({ page }) => {
  const response = await page.goto("/compendium/conditions/phb/prone");
  expect(response?.status()).toBe(404);
  await expectHydrated(page);

  await expect(page.getByText(/Conditions have no page of their own/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Browse Conditions/ })).toHaveAttribute(
    "href",
    "/compendium/conditions",
  );
});

/**
 * The collision this page was parked on for a fortnight. Creatures have a page
 * now, so a 404 under `/compendium/monsters/` is a mistyped slug — and the hint
 * must not confidently announce that creatures have no page of their own.
 */
test("stays quiet for a mistyped slug on a type that has a page", async ({
  page,
}) => {
  await page.goto("/compendium/monsters/mm/gobln");
  await expectHydrated(page);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/have no page of their own/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Browse/ })).toHaveCount(0);
});

/** And the real creature still resolves, which is what makes the above a typo. */
test("the creature it was reaching for does resolve", async ({ page }) => {
  await page.goto("/compendium/monsters/mm/goblin");
  await expectHydrated(page);

  await expect(page.locator("main h1")).toHaveText("Goblin");
});
