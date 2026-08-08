import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Runs before every file in the component project.
 *
 * Unmounting between tests is not automatic here: Testing Library only
 * registers its own `afterEach` when Vitest's globals are injected, and this
 * suite imports `describe`/`it`/`expect` explicitly instead. Without the call
 * below, every render would stay in the document and `screen` queries would
 * start matching leftovers from the previous test.
 */
afterEach(cleanup);

/**
 * jsdom implements no layout, so these are unimplemented rather than merely
 * inaccurate — calling them throws. Chakra reaches for both on mount, and a
 * component test should not fail over a scroll it never asserts on.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
