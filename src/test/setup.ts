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

/**
 * jsdom has the `<dialog>` element but not its modal behaviour, so `showModal`
 * is missing outright. The stub does the one part a component test can observe
 * — the element opens, and closing it fires `close` the way Escape and the
 * close button do. The top layer, the focus trap and the backdrop are the
 * browser's, and are checked in the browser.
 */
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

/**
 * jsdom implements no `ResizeObserver`, and `TableScrollers` uses one to decide
 * whether a table's region overflows — which is a fact about a laid-out box, so
 * jsdom could not answer it even if the class existed. The stub lets the app
 * shell mount; a component test asserts on structure and semantics, and
 * overflow behaviour is checked in the browser tier where boxes have real
 * widths. The enhancer's own test installs a stub it can drive.
 */
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
