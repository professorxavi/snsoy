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

/**
 * Where a sidebar sits in the document's outline, which only a rendered page
 * can show.
 *
 * A heading level is the only thing that says what contains what, and a boxed
 * variant used to get it wrong twice over: it printed its name at a fixed `h4`
 * while the named blocks within it kept rendering at the page's own `h3`. So
 * the sidebar skipped a level on the way in and its contents came out above it,
 * and anything navigating by heading was told they sit outside the box the eye
 * puts them in.
 *
 * The adult black dragon carries `Customizing Dragons`, which is that sidebar,
 * and `Languages` is the first block the book prints inside it.
 */
test("puts a sidebar's contents inside it", async ({ page }) => {
  await page.goto(`${MONSTERS}/mm/adult-black-dragon`);
  await expectHydrated(page);

  const outline = await page
    .locator("main :is(h1,h2,h3,h4,h5,h6)")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        level: Number(node.tagName.slice(1)),
        name: node.textContent?.trim() ?? "",
      })),
    );

  const at = outline.findIndex(({ name }) => name === "Customizing Dragons");
  expect(at).toBeGreaterThan(0);

  const before = outline[at - 1]!;
  const sidebar = outline[at]!;
  const inside = outline[at + 1]!;

  // Opening one level at a time. A heading may close any number of sections at
  // once, but gaining more than one step claims a parent nothing wrote.
  expect(sidebar.level).toBeLessThanOrEqual(before.level + 1);

  expect(inside.name).toBe("Languages");
  expect(inside.level).toBe(sidebar.level + 1);
});

/**
 * The whole outline, rather than one relationship inside it.
 *
 * This is the assertion the sidebar test above had to be narrowed down from. It
 * could not pass while a nameless grouping stepped the heading level whether or
 * not it printed anything: on this page that put `Brutal and Cruel` at `h5`
 * directly beneath an `h3`, a jump nothing visible accounts for. A reader
 * navigating by heading hears a section open inside a parent that was never
 * announced.
 *
 * Closing any number of sections at once is ordinary — a page returns from a
 * deep subsection to the next top-level one all the time. Opening more than one
 * at a time is the fault, and it is the only thing asserted here.
 */
test("never skips a heading level", async ({ page }) => {
  await page.goto(`${MONSTERS}/mm/adult-black-dragon`);
  await expectHydrated(page);

  const outline = await page
    .locator("main :is(h1,h2,h3,h4,h5,h6)")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        level: Number(node.tagName.slice(1)),
        name: node.textContent?.trim() ?? "",
      })),
    );

  expect(outline.length).toBeGreaterThan(3);

  const skips = outline.filter(
    (heading, index) => index > 0 && heading.level > outline[index - 1]!.level + 1,
  );

  expect(skips).toEqual([]);
});
