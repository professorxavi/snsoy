import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { ContentsSkeleton, ReadingSkeleton } from "./page-skeleton";

/**
 * A route fallback stands in for a whole page, which makes it a layout — and
 * the frame's rule for those is that each one owns the `<main id="main">` the
 * skip link lands on. A fallback without one breaks that link for as long as it
 * is showing, which is exactly when a keyboard user is most likely to reach for
 * it. Nothing else about these is worth pinning: they are placeholders, and
 * their proportions are meant to be free to change.
 */

describe("route fallbacks", () => {
  it("gives the skip link somewhere to land while a reading page loads", () => {
    const { container } = render(<ReadingSkeleton />);

    expect(container.querySelector("main#main")).not.toBeNull();
  });

  it("gives the skip link somewhere to land while a contents page loads", () => {
    const { container } = render(<ContentsSkeleton />);

    expect(container.querySelector("main#main")).not.toBeNull();
  });

  /*
   * The gutter is the one thing a caller chooses, and choosing wrong is visible:
   * the page shifts sideways as it lands. Queried by tag rather than by role and
   * name, since the gutter is hidden below `lg` and jsdom evaluates no media
   * queries either way.
   */
  it("holds the outline gutter open for a page that has one", () => {
    const { container } = render(<ReadingSkeleton />);

    expect(container.querySelector("nav")).not.toBeNull();
  });

  it("leaves it closed for a page that does not", () => {
    const { container } = render(<ReadingSkeleton outline={false} />);

    expect(container.querySelector("nav")).toBeNull();
  });
});
