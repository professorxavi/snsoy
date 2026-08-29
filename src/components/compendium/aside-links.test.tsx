/*
 * Bare anchors are the point here, not an oversight: this component's whole job
 * is to catch clicks on markup it does not own, and a fixture built out of
 * `next/link` would need a router before it rendered at all. The one thing a
 * bare anchor cannot stand in for — beating `next/link`'s own handler — is
 * asserted directly in "runs before the link's own handler".
 */
/* eslint-disable @next/next/no-html-link-for-pages */

import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { AsideProvider } from "./aside-context";
import { AsideLinks } from "./aside-links";
import { AsideSlot } from "./aside-slot";

/**
 * The wrapper that makes book text open in the aside.
 *
 * What matters is the discrimination: it must catch an entity link and let
 * everything else through untouched. Getting that wrong either strands the
 * reader on a page they did not ask for, or opens an empty panel over a type
 * with nothing to show.
 */

const load = () => vi.fn(async () => <p>loaded</p>);

const renderLinks = (
  loader: ReturnType<typeof load>,
  children: React.ReactNode,
) =>
  render(
    <AsideProvider>
      <AsideLinks load={loader}>{children}</AsideLinks>
    </AsideProvider>,
  );

/**
 * Clicks and reports whether the default was cancelled — which is the whole
 * question, since not cancelling means the browser navigates.
 *
 * Listens in the capture phase. The wrapper stops propagation on the links it
 * takes, so a bubble-phase listener never sees exactly the case worth
 * asserting. The event object is read after dispatch, when `defaultPrevented`
 * has settled.
 */
async function clickAndCapture(
  element: HTMLElement,
  user: ReturnType<typeof userEvent.setup> = userEvent.setup(),
) {
  let event: MouseEvent | undefined;
  const listen = (e: Event) => {
    event = e as MouseEvent;
  };

  document.addEventListener("click", listen, true);
  try {
    await user.click(element);
  } finally {
    document.removeEventListener("click", listen, true);
  }

  return event;
}

describe("AsideLinks", () => {
  it("opens a link to a type the aside can render", async () => {
    const loader = load();
    renderLinks(loader, <a href="/compendium/spells/phb/fireball">Fireball</a>);

    const event = await clickAndCapture(screen.getByRole("link"));

    expect(loader).toHaveBeenCalledWith("spell", "phb", "fireball", undefined);
    expect(event?.defaultPrevented).toBe(true);
  });

  /**
   * The largest class of link in the books by some way: 15,887 `{@creature}`
   * tags, more than spells, items and conditions together. Every one of them
   * navigated to a 404 until the stat block gave the aside something to show.
   */
  it("opens a creature in place rather than navigating to it", async () => {
    const loader = load();
    renderLinks(loader, <a href="/compendium/monsters/mm/goblin">Goblin</a>);

    const event = await clickAndCapture(screen.getByRole("link"));

    expect(loader).toHaveBeenCalledWith("monster", "mm", "goblin", undefined);
    expect(event?.defaultPrevented).toBe(true);
  });

  /**
   * A URL under `/compendium/` that names no known segment. This is what is
   * left of the case that used to be made with a type the aside cannot render —
   * a creature, then an item, then a sense, then a deity, then a vehicle, each
   * retired as its renderer landed, and now there is no such type at all. The
   * `ASIDE_TYPES` guard in the handler is still there and still right; the
   * invariant that leaves it unreachable is pinned in `aside.test.ts`.
   */
  it("leaves a compendium URL it cannot read alone", async () => {
    const loader = load();
    renderLinks(
      loader,
      <a href="/compendium/psionics/utmc/mantle-of-awe">Mantle</a>,
    );

    const event = await clickAndCapture(screen.getByRole("link"));

    expect(loader).not.toHaveBeenCalled();
    expect(event?.defaultPrevented).toBe(false);
  });

  /** A chapter is a page to read, not an entity to preview. */
  it("leaves a chapter link alone", async () => {
    const loader = load();
    renderLinks(loader, <a href="/sources/phb/combat">Combat</a>);

    const event = await clickAndCapture(screen.getByRole("link"));

    expect(loader).not.toHaveBeenCalled();
    expect(event?.defaultPrevented).toBe(false);
  });

  it("leaves a click that is not on a link alone", async () => {
    const loader = load();
    renderLinks(loader, <p>Just prose.</p>);

    await clickAndCapture(screen.getByText("Just prose."));

    expect(loader).not.toHaveBeenCalled();
  });

  /** ⌘-click and middle click belong to the browser, not to us. */
  it("lets a modified click through to the browser", async () => {
    const loader = load();
    renderLinks(loader, <a href="/compendium/spells/phb/fireball">Fireball</a>);

    // One `user` throughout: the modifier is held down between calls, and a
    // fresh instance per call would drop it.
    const user = userEvent.setup();
    await user.keyboard("{Meta>}");
    const event = await clickAndCapture(screen.getByRole("link"), user);
    await user.keyboard("{/Meta}");

    expect(event?.metaKey).toBe(true);
    expect(loader).not.toHaveBeenCalled();
    expect(event?.defaultPrevented).toBe(false);
  });

  /**
   * The regression that made this component work at all.
   *
   * These anchors are `next/link`s in production, and a `Link` calls
   * `router.push()` from its own click handler the moment it runs — so catching
   * the event on the way *up* is already too late, and `preventDefault` cannot
   * undo a navigation in progress. Interception has to happen in the capture
   * phase, and the link's handler must never run.
   *
   * A handler on the anchor stands in for `Link`'s. If it fires, the real thing
   * would have navigated.
   */
  it("runs before the link's own handler, not after", async () => {
    const loader = load();
    const linkHandler = vi.fn();

    renderLinks(
      loader,
      <a href="/compendium/spells/phb/fireball" onClick={linkHandler}>
        Fireball
      </a>,
    );

    await clickAndCapture(screen.getByRole("link"));

    expect(loader).toHaveBeenCalledOnce();
    expect(linkHandler).not.toHaveBeenCalled();
  });

  /**
   * The aside wraps its own body, so a reference inside an open entity opens
   * the next one. That also catches "Open full page", which points at the very
   * entity already showing — and because the key matches what is open, the
   * click is swallowed and the link does nothing at all. Opting out is what
   * lets a link whose whole purpose is to leave actually leave.
   */
  it("leaves an opted-out link alone", async () => {
    const loader = load();
    renderLinks(
      loader,
      <div data-aside-ignore="">
        <a href="/compendium/spells/phb/fireball">Open full page</a>
      </div>,
    );

    const event = await clickAndCapture(screen.getByRole("link"));

    expect(loader).not.toHaveBeenCalled();
    expect(event?.defaultPrevented).toBe(false);
  });

  /**
   * Sibling, not depth.
   *
   * Links on a page are peers of one another, so opening a second replaces the
   * first. Stacking them instead would grow a back stack as long as the
   * browsing session — 25 spells read is 25 presses to unwind — which is the
   * history bug the aside was rebuilt to escape, reinvented inside the panel.
   */
  it("replaces what is open when a page link is followed", async () => {
    const loader = load();

    // The slot is rendered too: the back button is the only place the stack's
    // depth is visible from outside the context.
    render(
      <AsideProvider>
        <AsideLinks load={loader}>
          <a href="/compendium/spells/phb/fireball">Fireball</a>
          <a href="/compendium/spells/phb/light">Light</a>
        </AsideLinks>
        <AsideSlot load={loader} />
      </AsideProvider>,
    );

    await clickAndCapture(screen.getByRole("link", { name: "Fireball" }));
    await clickAndCapture(screen.getByRole("link", { name: "Light" }));

    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^←/ }),
    ).not.toBeInTheDocument();
  });

  /** Following a reference from inside the aside is depth, and back returns. */
  it("stacks when a reference inside the aside is followed", async () => {
    // The body carries a reference of its own, the way a real entity does.
    const loader = vi.fn(async () => (
      <a href="/compendium/spells/phb/fireball">Fireball</a>
    ));

    render(
      <AsideProvider>
        <AsideLinks load={loader}>
          <a href="/compendium/classes/phb/wizard">Wizard</a>
        </AsideLinks>
        <AsideSlot load={loader} />
      </AsideProvider>,
    );

    await clickAndCapture(screen.getByRole("link", { name: "Wizard" }));
    await clickAndCapture(screen.getByRole("link", { name: "Fireball" }));

    expect(
      screen.getByRole("button", { name: /^←\s*Wizard/ }),
    ).toBeInTheDocument();
  });

  /** The click lands on the text inside the anchor, not the anchor itself. */
  it("finds the link from whatever inside it was clicked", async () => {
    const loader = load();
    renderLinks(
      loader,
      <a href="/compendium/classes/phb/wizard">
        <em>Wizard</em>
      </a>,
    );

    await clickAndCapture(screen.getByText("Wizard"));

    expect(loader).toHaveBeenCalledWith("class", "phb", "wizard", undefined);
  });

  /**
   * A subrace is an anchor on its parent's page and nothing else, so the
   * anchor is the only thing saying which one was clicked. Without it every
   * bloodline in a chapter opened the plain race.
   */
  it("says which part of an entity a fragment named", async () => {
    const loader = load();
    renderLinks(
      loader,
      <a href="/compendium/races/phb/tiefling#glasya">Tiefling (Glasya)</a>,
    );

    await clickAndCapture(screen.getByText("Tiefling (Glasya)"));

    expect(loader).toHaveBeenCalledWith("race", "phb", "tiefling", "glasya");
  });
});
