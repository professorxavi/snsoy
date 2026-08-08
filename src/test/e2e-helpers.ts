import { expect, type Page } from "@playwright/test";

/**
 * Shared helpers for the browser tier.
 *
 * Named `e2e-helpers` rather than `e2e` so neither runner mistakes it for a
 * test file: Playwright matches `*.e2e.ts` and Vitest matches `*.test.ts`.
 */

/** Selectors for the pieces of the browse frame the layout assertions target. */
export const ASIDE = "[data-aside-content]";
export const RAIL = '[aria-label="Filters"]';
export const OPTIONAL_COLUMN = "[data-col-optional]";
/** The reading outline on a race page. Chapters label theirs differently. */
export const OUTLINE = 'nav[aria-label="On this page"]';
export const ROWS = "tbody tr";

/**
 * Has React attached to the document?
 *
 * The single most valuable assertion in this tier. Every page in this app is
 * server-rendered, so one that never hydrates looks completely correct — it
 * renders, it is styled, its links work — and only stops responding to the
 * handful of things that need JavaScript. That failure has already been
 * mistaken once for a bug in a component library.
 *
 * Detected by React's own marker on a DOM node rather than by clicking
 * something, so it reports the actual condition instead of a symptom.
 */
export async function expectHydrated(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const nodes = document.querySelectorAll("a[href], button, summary");
          return [...nodes].some((node) =>
            Object.keys(node).some((key) => key.startsWith("__reactProps$")),
          );
        }),
      { message: "page never hydrated", timeout: 20_000 },
    )
    .toBe(true);
}

/**
 * Does the element stand the full height of the viewport below the top bar?
 *
 * The rail and the aside are both full-height columns, and both have regressed
 * to content height before. Measured against the topbar token rather than a
 * hardcoded pixel value so the assertion survives the bar changing size.
 */
export async function fillsViewportBelowTopbar(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;

    const topbar = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--chakra-sizes-topbar",
      ),
    );
    const height = el.getBoundingClientRect().height;
    return Math.abs(height - (window.innerHeight - topbar)) < 2;
  }, selector);
}

/** Is the element inside the viewport, rather than scrolled past or below it? */
export async function isInView(page: Page, id: string) {
  return page.evaluate((elementId) => {
    const el = document.getElementById(elementId);
    if (!el) return null;
    const { top } = el.getBoundingClientRect();
    return top >= -5 && top < window.innerHeight;
  }, id);
}

/** Is the `<details>` wrapping this anchor open? */
export async function isDisclosureOpen(page: Page, id: string) {
  return page.evaluate((elementId) => {
    const anchor = document.getElementById(elementId);
    return anchor?.closest("details")?.open ?? null;
  }, id);
}
