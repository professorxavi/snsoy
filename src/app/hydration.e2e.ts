import { expect, test } from "@playwright/test";
import { expectHydrated } from "@/test/e2e-helpers";

/**
 * Does the app run JavaScript at all?
 *
 * Nothing cheaper can answer this. Every route here is server-rendered, so a
 * build that never hydrates serves pages that look perfect — correct markup,
 * correct styling, working links — and the entire Vitest suite stays green.
 * Only the few things that need JavaScript stop, and because so little of this
 * app does, the outage sits unnoticed until someone reaches for one of them
 * and concludes that component is broken. That has happened here, and the
 * wrong conclusion was written into a source comment as a fact about a
 * third-party library.
 *
 * One test, not one per route. The bootstrap bundle is shared by the whole
 * app: when it fails to load, every page fails together, so checking five
 * routes is the same assertion five times.
 */

test("the app hydrates", async ({ page }) => {
  const broken: string[] = [];

  page.on("requestfailed", (request) =>
    broken.push(`${request.failure()?.errorText} ${request.url()}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/_next/")) {
      broken.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/compendium/spells");
  await expectHydrated(page);

  // A 404 on a bundle is how this outage actually presents.
  expect(broken).toEqual([]);
});
