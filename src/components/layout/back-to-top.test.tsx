import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import { BackToTop } from "./back-to-top";

/** jsdom has no layout, so the viewport and the scroll are both stated here. */
function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  fireEvent.scroll(window);
}

afterEach(() => {
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  document.getElementById("main")?.remove();
  vi.restoreAllMocks();
});

/** The element the button hands focus to, as `ReadingColumn` renders it. */
function plantMain() {
  const main = document.createElement("div");
  main.id = "main";
  main.tabIndex = -1;
  document.body.append(main);
  return main;
}

/**
 * `hidden`, and unnamed, because the button hides with `display: none` — which
 * is the point: out of the tab order and out of the accessibility tree until
 * there is somewhere to go back from. A hidden node has no accessible name to
 * match on, so the name is asserted on its own below.
 */
const button = () => screen.getByRole("button", { hidden: true });

describe("BackToTop", () => {
  it("stays out of the way until a screen has been scrolled", () => {
    render(<BackToTop clearsOutline={false} />);

    expect(button()).not.toBeVisible();
  });

  it("appears once the reader is a screen down", async () => {
    render(<BackToTop clearsOutline={false} />);

    scrollTo(window.innerHeight + 1);

    await vi.waitFor(() => expect(button()).toBeVisible());
    expect(
      screen.getByRole("button", { name: "Back to top" }),
    ).toBeInTheDocument();
  });

  it("goes away again on the way back up", async () => {
    render(<BackToTop clearsOutline={false} />);

    scrollTo(window.innerHeight + 1);
    await vi.waitFor(() => expect(button()).toBeVisible());

    scrollTo(0);
    await vi.waitFor(() => expect(button()).not.toBeVisible());
  });

  it("scrolls to the top when pressed", () => {
    const scrolled = vi.fn();
    vi.stubGlobal("scrollTo", scrolled);
    render(<BackToTop clearsOutline={false} />);

    fireEvent.click(button());

    expect(scrolled).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("jumps rather than glides for a reader who asked for less motion", () => {
    const scrolled = vi.fn();
    vi.stubGlobal("scrollTo", scrolled);
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({ matches: query.includes("reduce") }) as MediaQueryList,
    );
    render(<BackToTop clearsOutline={false} />);

    fireEvent.click(button());

    expect(scrolled).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  /**
   * Without this the keyboard stays at the foot of the chapter while the page
   * shows the top of it, and the next Tab carries on from where the reader
   * was rather than from what they are looking at.
   */
  it("puts the keyboard at the top too", () => {
    vi.stubGlobal("scrollTo", vi.fn());
    const main = plantMain();
    render(<BackToTop clearsOutline={false} />);

    fireEvent.click(button());

    expect(document.activeElement).toBe(main);
  });

  it("survives a page that has no main to focus", () => {
    vi.stubGlobal("scrollTo", vi.fn());
    render(<BackToTop clearsOutline={false} />);

    expect(() => fireEvent.click(button())).not.toThrow();
  });
});
