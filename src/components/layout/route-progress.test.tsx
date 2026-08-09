import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASIDE_OPEN_ATTR } from "@/lib/aside";
import { render } from "@/test/render";
import { RouteProgress, leadsToANavigation } from "./route-progress";

/**
 * The bar has two halves worth covering, and they fail differently.
 *
 * Deciding whether a click is going anywhere is the half that produces visible
 * bugs: every case below is a click this app actually makes, and treating any
 * of them as a page load puts a progress bar on something that never loads —
 * most damagingly on an entity link, which cancels its own navigation to open
 * the aside instead.
 *
 * The timing half is covered for one behaviour only: the wait is reported when
 * it is long enough to be worth reporting and not otherwise. That grace period
 * is the whole reason this does not flicker on every click of a cached page.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const HERE = "/compendium/spells?level=1";

beforeEach(() => {
  window.history.pushState({}, "", HERE);
});

afterEach(() => {
  if (stopNavigation) window.removeEventListener("click", stopNavigation);
  stopNavigation = null;
  document.body.innerHTML = "";
});

describe("leadsToANavigation", () => {
  it("tracks a link to another page", () => {
    expect(leadsToANavigation(clickOn(anchor({ href: "/sources/phb" })))).toBe(
      true,
    );
  });

  it("tracks a link that only changes the query", () => {
    // Filters, sort and paging are all links, and they are the navigations the
    // reader makes most. They are also the ones no route fallback covers.
    const link = anchor({ href: "/compendium/spells?level=2" });

    expect(leadsToANavigation(clickOn(link))).toBe(true);
  });

  it("tracks a click on an element inside the link", () => {
    const link = anchor({ href: "/sources/phb" });
    const inner = document.createElement("span");
    link.append(inner);

    expect(leadsToANavigation(clickOn(link, {}, inner))).toBe(true);
  });

  it("ignores a fragment on the page already open", () => {
    // The chapter outline. It scrolls; nothing is fetched.
    const link = anchor({ href: `${HERE}#combat` });

    expect(leadsToANavigation(clickOn(link))).toBe(false);
  });

  it("ignores a browse row, which opens the aside instead", () => {
    const link = anchor({
      href: "/compendium/spells/phb/fireball",
      [ASIDE_OPEN_ATTR]: "",
    });

    expect(leadsToANavigation(clickOn(link))).toBe(false);
  });

  /**
   * The trap this whole predicate exists to avoid. `next/link` cancels its own
   * click before handing off to the router, so a cancelled click is what a
   * normal navigation looks like — reading `defaultPrevented` as "handled by
   * someone else" silences the bar everywhere.
   */
  it("tracks a link whose click has been cancelled", () => {
    const link = anchor({ href: "/sources/phb" });
    const event = clickOn(link);
    event.preventDefault();

    expect(leadsToANavigation(event)).toBe(true);
  });

  it("ignores a link off the site", () => {
    expect(
      leadsToANavigation(clickOn(anchor({ href: "https://example.com/x" }))),
    ).toBe(false);
  });

  it("ignores a link opening in another tab", () => {
    const link = anchor({ href: "/sources/phb", target: "_blank" });

    expect(leadsToANavigation(clickOn(link))).toBe(false);
  });

  it("ignores a download", () => {
    const link = anchor({ href: "/api/media/cover.png", download: "" });

    expect(leadsToANavigation(clickOn(link))).toBe(false);
  });

  it("ignores an anchor with no href", () => {
    expect(leadsToANavigation(clickOn(anchor({})))).toBe(false);
  });

  it("ignores a click that is not on a link at all", () => {
    const button = document.createElement("button");
    document.body.append(button);

    expect(leadsToANavigation(clickOn(null, {}, button))).toBe(false);
  });

  /** Each of these opens a tab or a menu rather than moving this one. */
  const UNMODIFIED_ONLY = [
    ["a middle click", { button: 1 }],
    ["a ⌘-click", { metaKey: true }],
    ["a ctrl-click", { ctrlKey: true }],
    ["a shift-click", { shiftKey: true }],
    ["an alt-click", { altKey: true }],
  ] as const;

  for (const [what, init] of UNMODIFIED_ONLY) {
    it(`ignores ${what}`, () => {
      const link = anchor({ href: "/sources/phb" });

      expect(leadsToANavigation(clickOn(link, init))).toBe(false);
    });
  }
});

describe("RouteProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says nothing about a navigation that lands quickly", () => {
    const { container } = renderBar();

    click("/sources/phb");
    act(() => void vi.advanceTimersByTime(100));

    // Asserted here rather than at the end, where an empty container would only
    // mean the bar had been and gone: the point is that a short wait is never
    // drawn at all, and a flash of one is the bug this is guarding.
    expect(container).toBeEmptyDOMElement();

    arriveAt("/sources/phb");
    act(() => void vi.advanceTimersByTime(400));

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the bar once the wait is long enough to mention", () => {
    const { container } = renderBar();

    click("/sources/phb");
    act(() => void vi.advanceTimersByTime(400));

    expect(container).not.toBeEmptyDOMElement();
  });

  it("clears the bar when the page arrives", () => {
    const { container } = renderBar();

    click("/sources/phb");
    act(() => void vi.advanceTimersByTime(400));
    arriveAt("/sources/phb");
    // The tick that notices, then the fill and fade that follow it.
    act(() => void vi.advanceTimersByTime(400));

    expect(container).toBeEmptyDOMElement();
  });

  it("lets go of a navigation that never arrives", () => {
    const { container } = renderBar();

    click("/sources/phb");
    act(() => void vi.advanceTimersByTime(400));
    expect(container).not.toBeEmptyDOMElement();

    act(() => void vi.advanceTimersByTime(20_000));

    expect(container).toBeEmptyDOMElement();
  });

  it("stays out of the way of a click that goes nowhere", () => {
    const { container } = renderBar();

    click(`${HERE}#combat`);
    act(() => void vi.advanceTimersByTime(2_000));

    expect(container).toBeEmptyDOMElement();
  });
});

/* -------------------------------------------------------------------------- */

function anchor(attributes: Record<string, string>): HTMLAnchorElement {
  const element = document.createElement("a");
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  document.body.append(element);
  return element;
}

/**
 * A click, built rather than dispatched.
 *
 * `target` is read-only on a real event and only set by dispatch, so it is
 * defined here instead — which also keeps jsdom from trying to follow the href
 * and warning that navigation is not implemented.
 */
function clickOn(
  link: HTMLAnchorElement | null,
  init: MouseEventInit = {},
  from: Element | null = link,
): MouseEvent {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  Object.defineProperty(event, "target", { value: from });
  return event;
}

let stopNavigation: ((event: MouseEvent) => void) | null = null;

function renderBar() {
  const result = render(<RouteProgress />);

  // Keeps jsdom from trying to follow the href and warning that navigation is
  // not implemented. Harmless to the bar, which does not read `defaultPrevented`
  // — and a real `next/link` would have cancelled the click here anyway.
  stopNavigation = (event: MouseEvent) => event.preventDefault();
  window.addEventListener("click", stopNavigation);
  return result;
}

/** A real click, dispatched so the component's window listener catches it. */
function click(href: string): void {
  act(() => {
    anchor({ href }).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });
}

/** What the router does on commit, and the only signal the bar watches for. */
function arriveAt(href: string): void {
  window.history.pushState({}, "", href);
}
