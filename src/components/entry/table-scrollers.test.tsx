import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, waitFor } from "@/test/render";
import { TableScrollers } from "./table-scrollers";

/**
 * One enhancer for every table on the page.
 *
 * What it decides is small — whether a box scrolls, and so whether it is worth
 * a tab stop and a name — but it decides it for tables it did not render, that
 * arrive after it mounts and leave before it unmounts. That is the whole reason
 * it replaced a component per table, so those are the cases tested here.
 *
 * jsdom lays nothing out, so geometry is declared on the fixture and read back
 * through prototype getters. The numbers are not the point; which of them the
 * enhancer looks at is.
 */

type Geometry = {
  scrollWidth?: number;
  clientWidth?: number;
  scrollHeight?: number;
  clientHeight?: number;
};

const MEASURES = [
  "scrollWidth",
  "clientWidth",
  "scrollHeight",
  "clientHeight",
] as const;

const original = new Map<string, PropertyDescriptor | undefined>();

/** Every observer made, so a test can fire one the way a real resize would. */
const observers: { fire: () => void; targets: Set<Element> }[] = [];

beforeAll(() => {
  for (const measure of MEASURES) {
    original.set(
      measure,
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, measure),
    );
    Object.defineProperty(HTMLElement.prototype, measure, {
      configurable: true,
      get(this: HTMLElement) {
        return Number(this.dataset[measure.toLowerCase()] ?? 0);
      },
    });
  }

  window.ResizeObserver = class {
    targets = new Set<Element>();
    constructor(private callback: ResizeObserverCallback) {
      observers.push({ targets: this.targets, fire: () => this.run() });
    }
    observe(target: Element) {
      this.targets.add(target);
    }
    unobserve(target: Element) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
    }
    private run() {
      this.callback(
        [...this.targets].map((target) => ({ target }) as ResizeObserverEntry),
        this as unknown as ResizeObserver,
      );
    }
  } as unknown as typeof ResizeObserver;
});

afterAll(() => {
  for (const measure of MEASURES) {
    const descriptor = original.get(measure);
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, measure, descriptor);
    }
  }
});

afterEach(() => {
  observers.length = 0;
});

function scroller(geometry: Geometry, label?: string, bounded?: boolean) {
  return (
    <div
      data-testid="scroller"
      data-table-scroll=""
      {...(bounded ? { "data-table-bounded": "" } : {})}
      {...(label ? { "data-table-label": label } : {})}
      data-scrollwidth={geometry.scrollWidth ?? 0}
      data-clientwidth={geometry.clientWidth ?? 0}
      data-scrollheight={geometry.scrollHeight ?? 0}
      data-clientheight={geometry.clientHeight ?? 0}
    >
      <table>
        <tbody>
          <tr>
            <td>Roll</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

describe("TableScrollers", () => {
  it("leaves a table that fits out of the tab order", async () => {
    const { getByTestId } = render(
      <>
        <TableScrollers />
        {scroller({ scrollWidth: 400, clientWidth: 400, scrollHeight: 200, clientHeight: 200 })}
      </>,
    );

    await waitFor(() => {
      const node = getByTestId("scroller");
      expect(node).not.toHaveAttribute("tabindex");
      expect(node).not.toHaveAttribute("role");
    });
  });

  it("reaches a table that overflows sideways", async () => {
    const { getByTestId } = render(
      <>
        <TableScrollers />
        {scroller(
          { scrollWidth: 900, clientWidth: 400, scrollHeight: 200, clientHeight: 200 },
          "Omu Encounters table",
        )}
      </>,
    );

    await waitFor(() => {
      const node = getByTestId("scroller");
      expect(node).toHaveAttribute("tabindex", "0");
      expect(node).toHaveAttribute("role", "region");
      expect(node).toHaveAttribute("aria-label", "Omu Encounters table");
      expect(node).toHaveAttribute("data-overflow-end");
    });
  });

  /**
   * The finding that opened the second pass. Wilderness Encounters fits across
   * a desktop frame and is bounded to a fraction of its height, and looking
   * only sideways left it with no keyboard way in at all.
   */
  it("reaches a table that overflows only downwards", async () => {
    const { getByTestId } = render(
      <>
        <TableScrollers />
        {scroller(
          { scrollWidth: 400, clientWidth: 400, scrollHeight: 4000, clientHeight: 600 },
          "Wilderness Encounters table",
          true,
        )}
      </>,
    );

    await waitFor(() => {
      const node = getByTestId("scroller");
      expect(node).toHaveAttribute("tabindex", "0");
      expect(node).toHaveAttribute("data-overflow-block");
      // The edge keylines are for the inline axis and nothing has moved.
      expect(node).not.toHaveAttribute("data-overflow-end");
    });
  });

  /**
   * A box in normal flow grows to whatever it holds, so a difference between
   * its two heights is the box measuring itself rather than somewhere a reader
   * could scroll to. Only the frame knows which boxes it capped.
   */
  it("ignores height on a table it never bounded", async () => {
    const { getByTestId } = render(
      <>
        <TableScrollers />
        {scroller({ scrollWidth: 400, clientWidth: 400, scrollHeight: 4000, clientHeight: 600 })}
      </>,
    );

    await waitFor(() => {
      const node = getByTestId("scroller");
      expect(node).not.toHaveAttribute("tabindex");
      expect(node).not.toHaveAttribute("data-overflow-block");
    });
  });

  it("finds a table that arrives after it mounts", async () => {
    const { getByTestId } = render(
      <>
        <TableScrollers />
        <div id="chapter" />
      </>,
    );

    const streamed = document.createElement("div");
    streamed.dataset.testid = "streamed";
    streamed.setAttribute("data-table-scroll", "");
    streamed.setAttribute("data-table-label", "Magic Item Table G table");
    Object.assign(streamed.dataset, {
      scrollwidth: "900",
      clientwidth: "400",
      scrollheight: "200",
      clientheight: "200",
    });
    document.getElementById("chapter")!.append(streamed);

    await waitFor(() => {
      expect(getByTestId("streamed")).toHaveAttribute("tabindex", "0");
    });
  });

  it("stops watching a table the page has removed", async () => {
    const { getByTestId, rerender } = render(
      <>
        <TableScrollers />
        {scroller({ scrollWidth: 900, clientWidth: 400 })}
      </>,
    );

    const node = await waitFor(() => getByTestId("scroller"));
    rerender(
      <>
        <TableScrollers />
        <div id="chapter" />
      </>,
    );

    await waitFor(() => {
      expect(observers.some((one) => one.targets.has(node))).toBe(false);
    });
  });

  /**
   * The table, not whatever happens to be first.
   *
   * Chakra emits a `<style>` node ahead of the table it belongs to, which has
   * no geometry at all — so observing the first child meant the one box that
   * changes when content or a font does was never watched, and the overflow
   * state went stale without anything appearing to be wrong.
   */
  it("watches the table rather than a style node beside it", async () => {
    const { getByTestId } = render(
      <>
        <TableScrollers />
        <div
          data-testid="scroller"
          data-table-scroll=""
          data-table-label="Port Nyanzaru Encounters table"
          data-scrollwidth="400"
          data-clientwidth="400"
        >
          <style>{".css-1{color:red}"}</style>
          <table data-testid="table">
            <tbody>
              <tr>
                <td>Roll</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>,
    );

    const node = await waitFor(() => getByTestId("scroller"));
    expect(observers.some((one) => one.targets.has(getByTestId("table")))).toBe(
      true,
    );

    // And the state follows the table growing, with the owner unchanged.
    node.dataset.scrollwidth = "900";
    for (const one of observers) one.fire();

    expect(node).toHaveAttribute("tabindex", "0");
    expect(node).toHaveAttribute("aria-label", "Port Nyanzaru Encounters table");
    expect(node).toHaveAttribute("data-overflow-end");
  });

  /** A list that re-sorts hands its owner a different table. */
  it("follows a table that is replaced under the same owner", async () => {
    const { getByTestId } = render(
      <>
        <TableScrollers />
        {scroller({ scrollWidth: 900, clientWidth: 400 })}
      </>,
    );

    const node = await waitFor(() => getByTestId("scroller"));
    const first = node.querySelector("table")!;

    const replacement = document.createElement("table");
    replacement.id = "replacement";
    first.replaceWith(replacement);

    await waitFor(() => {
      expect(observers.some((one) => one.targets.has(replacement))).toBe(true);
      expect(observers.some((one) => one.targets.has(first))).toBe(false);
    });
  });

  it("gives up the tab stop when a resize makes the table fit", async () => {
    const { getByTestId } = render(
      <>
        <TableScrollers />
        {scroller({ scrollWidth: 900, clientWidth: 400 }, "Omu Encounters table")}
      </>,
    );

    const node = await waitFor(() => {
      const found = getByTestId("scroller");
      expect(found).toHaveAttribute("tabindex", "0");
      return found;
    });

    node.dataset.clientwidth = "900";
    for (const one of observers) one.fire();

    expect(node).not.toHaveAttribute("tabindex");
    expect(node).not.toHaveAttribute("role");
    expect(node).not.toHaveAttribute("aria-label");
  });
});
