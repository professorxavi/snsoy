import { expect, type Page } from "@playwright/test";
import { ROUTE_FALLBACK_ATTR } from "@/components/layout";

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
 * Has React attached to the document, and is the real page the one attached to?
 *
 * The single most valuable assertion in this tier. Every page in this app is
 * server-rendered, so one that never hydrates looks completely correct — it
 * renders, it is styled, its links work — and only stops responding to the
 * handful of things that need JavaScript. That failure has already been
 * mistaken once for a bug in a component library.
 *
 * Detected by React's own marker on a DOM node rather than by clicking
 * something, so it reports the actual condition instead of a symptom.
 *
 * The second half is the route fallback, and it is not a formality. A route
 * with a `loading.tsx` streams: the fallback is served first as real, hydrated
 * markup, and the page arrives afterwards inside a hidden block that React
 * swaps in. React's marker is on the fallback the moment it lands, so waiting
 * for hydration alone returns while the page proper is still in that block —
 * present in the DOM, queryable, and measuring zero in every dimension.
 */
export async function expectHydrated(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate((fallback) => {
          if (document.querySelector(`[${fallback}]`)) return false;

          const nodes = document.querySelectorAll("a[href], button, summary");
          return [...nodes].some((node) =>
            Object.keys(node).some((key) => key.startsWith("__reactProps$")),
          );
        }, ROUTE_FALLBACK_ATTR),
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

/**
 * The same, waited for rather than sampled once.
 *
 * A fragment scroll is not synchronous with hydration: the browser expands the
 * `<details>` the anchor is nested in and then scrolls, and on a warm server the
 * assertion can arrive between the two. Sampled once it passed for as long as
 * the page happened to be slow, and began failing the moment another file ran
 * before it — which is a property of the test, not of the page.
 */
export async function expectInView(page: Page, id: string) {
  await expect
    .poll(() => isInView(page, id), {
      message: `#${id} never scrolled into view`,
      timeout: 10_000,
    })
    .toBe(true);
}

/** Is the `<details>` wrapping this anchor open? */
export async function isDisclosureOpen(page: Page, id: string) {
  return page.evaluate((elementId) => {
    const anchor = document.getElementById(elementId);
    return anchor?.closest("details")?.open ?? null;
  }, id);
}
