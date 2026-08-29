import { expect, test } from "@playwright/test";

/**
 * Does the type stack reach the page?
 *
 * Nothing cheaper can answer this either. Chakra defines its font tokens as
 * `--chakra-fonts-ui: var(--font-ui), system-ui, sans-serif`, and a custom
 * property that references an undefined custom property is guaranteed-invalid —
 * so if `--font-ui` is declared anywhere the token cannot see, every
 * `--chakra-fonts-*` computes to the empty string, `font-family` becomes
 * invalid at computed-value time, and the whole app renders in the browser's
 * default sans.
 *
 * That is not hypothetical. It was live here from the font wiring until
 * `761c3dd` on 2026-08-26, because the `next/font` variables were on `<body>`
 * rather than `<html>`. Alfa Slab One, Literata and IBM Plex Sans were all
 * fetched and none of them were ever on screen, and it is most of why the UI
 * read as generic for months.
 *
 * Nothing caught it. `tsc`, eslint and the entire Vitest suite were green
 * throughout, and they would be again: jsdom neither resolves custom properties
 * nor loads fonts, so only a browser can see this.
 *
 * Colours are checked alongside as the control. Their token values are literal
 * hex rather than `var()` references, so they resolve either way — which is the
 * asymmetry that hid the fault, because the theme looks like it is working.
 *
 * One route, not one per page. The tokens are defined once on `:root` for the
 * whole app; if they resolve anywhere they resolve everywhere.
 */

test("the fonts the theme names are the fonts the page uses", async ({ page }) => {
  await page.goto("/");

  const type = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const token = (name: string) => root.getPropertyValue(name).trim();
    const face = (selector: string) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).fontFamily : "";
    };

    return {
      ui: token("--chakra-fonts-ui"),
      body: token("--chakra-fonts-body"),
      display: token("--chakra-fonts-display"),
      heading: token("--chakra-fonts-heading"),
      colour: token("--chakra-colors-brand-400"),
      h1: face("h1"),
      prose: face(".prose"),
    };
  });

  // The control: this resolves even when every font token is empty.
  expect(type.colour).not.toBe("");

  // An empty string here is the bug, and is exactly how it presented.
  for (const name of ["ui", "body", "display", "heading"] as const) {
    expect(type[name], `--chakra-fonts-${name} is empty`).not.toBe("");
  }

  // A resolved token still proves nothing if it never reaches an element, so
  // the two faces a reader actually meets are checked on the elements using
  // them: the masthead in the display face, body copy in the reading face.
  expect(type.h1).toContain("Alfa Slab One");
  expect(type.prose).toContain("Literata");
});
