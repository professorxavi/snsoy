import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/render";
import { AsideProvider, useAside } from "./aside-context";

/**
 * The aside's state machine.
 *
 * Only the parts that are about *time*, because those are the ones no other
 * tier can see and the ones that have gone wrong. Every reply here is a
 * deliberately delayed promise; what is asserted is which of them is allowed to
 * reach the panel.
 *
 * The component tests for the panels themselves assert what one entity renders,
 * and the browser tests assert that a click opens one. Neither can express "a
 * slow reply for the row you have already moved off must be discarded", which
 * is the property this file exists for.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/compendium/spells",
}));

/** Resolves when told to, so a test controls exactly when a reply lands. */
function deferred<T>() {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

function Harness({
  loaders,
}: {
  /** Key to the thunk that resolves its body. */
  loaders: Record<string, () => Promise<string>>;
}) {
  const { openKey, node, pending, previous, open, back, close } = useAside();

  return (
    <div>
      <output data-testid="key">{openKey ?? "none"}</output>
      <output data-testid="node">{node}</output>
      <output data-testid="pending">{pending ? "loading" : "idle"}</output>
      <output data-testid="previous">{previous?.key ?? "none"}</output>

      {Object.keys(loaders).map((key) => (
        <button key={key} type="button" onClick={() => open(key, loaders[key]!)}>
          open {key}
        </button>
      ))}
      <button
        type="button"
        onClick={() => open("b", loaders["b"]!, { push: true, label: "B" })}
      >
        push b
      </button>
      <button type="button" onClick={back}>
        back
      </button>
      <button type="button" onClick={close}>
        close
      </button>
    </div>
  );
}

const setup = (loaders: Record<string, () => Promise<string>>) => {
  render(
    <AsideProvider>
      <Harness loaders={loaders} />
    </AsideProvider>,
  );
  return userEvent.setup();
};

const node = () => screen.getByTestId("node").textContent;
const key = () => screen.getByTestId("key").textContent;

describe("AsideProvider", () => {
  it("shows the body once its reply lands", async () => {
    const a = deferred<string>();
    const user = setup({ a: () => a.promise });

    await user.click(screen.getByRole("button", { name: "open a" }));
    expect(key()).toBe("a");
    expect(node()).toBe("");

    a.settle("A body");
    await waitFor(() => expect(node()).toBe("A body"));
  });

  describe("which reply is allowed to land", () => {
    /**
     * The property the whole guard exists for. Clicking three rows quickly can
     * resolve in any order; the last click has to win regardless.
     */
    it("discards a reply for something the reader has moved off", async () => {
      const a = deferred<string>();
      const b = deferred<string>();
      const user = setup({ a: () => a.promise, b: () => b.promise });

      await user.click(screen.getByRole("button", { name: "open a" }));
      await user.click(screen.getByRole("button", { name: "open b" }));

      // The stale one resolves last, which is the case that used to break.
      b.settle("B body");
      await waitFor(() => expect(node()).toBe("B body"));

      a.settle("A body");
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(node()).toBe("B body");
      expect(key()).toBe("b");
    });

    /** Nothing in flight may populate a panel the reader has already closed. */
    it("discards a reply that lands after close", async () => {
      const a = deferred<string>();
      const user = setup({ a: () => a.promise });

      await user.click(screen.getByRole("button", { name: "open a" }));
      await user.click(screen.getByRole("button", { name: "close" }));
      expect(key()).toBe("none");

      a.settle("A body");
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(key()).toBe("none");
      expect(node()).toBe("");
    });

    /**
     * Closing must not poison the entity against being opened again — the
     * dedupe guard has to be released, or a row goes dead after one look.
     */
    it("reopens what was just closed", async () => {
      const first = deferred<string>();
      let call = 0;
      const loaders = {
        a: () => {
          call += 1;
          return call === 1 ? first.promise : Promise.resolve("A again");
        },
      };
      const user = setup(loaders);

      await user.click(screen.getByRole("button", { name: "open a" }));
      first.settle("A body");
      await waitFor(() => expect(node()).toBe("A body"));

      await user.click(screen.getByRole("button", { name: "close" }));
      await user.click(screen.getByRole("button", { name: "open a" }));

      await waitFor(() => expect(key()).toBe("a"));
      // Served from the cache, so the loader is not called a second time.
      expect(call).toBe(1);
      expect(node()).toBe("A body");
    });
  });

  describe("the reading stack", () => {
    it("replaces by default, so siblings do not stack", async () => {
      const user = setup({
        a: () => Promise.resolve("A"),
        b: () => Promise.resolve("B"),
      });

      await user.click(screen.getByRole("button", { name: "open a" }));
      await user.click(screen.getByRole("button", { name: "open b" }));

      await waitFor(() => expect(key()).toBe("b"));
      expect(screen.getByTestId("previous")).toHaveTextContent("none");
    });

    /** Following a reference from inside an entity goes deeper, and back returns. */
    it("stacks when pushed, and back unwinds to the cached body", async () => {
      const user = setup({
        a: () => Promise.resolve("A"),
        b: () => Promise.resolve("B"),
      });

      await user.click(screen.getByRole("button", { name: "open a" }));
      await waitFor(() => expect(node()).toBe("A"));

      await user.click(screen.getByRole("button", { name: "push b" }));
      await waitFor(() => expect(node()).toBe("B"));
      expect(screen.getByTestId("previous")).toHaveTextContent("a");

      await user.click(screen.getByRole("button", { name: "back" }));
      expect(key()).toBe("a");
      expect(node()).toBe("A");
    });

    /**
     * Back must not be overwritten by a reply that was still in flight for the
     * level it just left.
     */
    it("holds what back returned to when a later reply lands", async () => {
      const b = deferred<string>();
      const user = setup({
        a: () => Promise.resolve("A"),
        b: () => b.promise,
      });

      await user.click(screen.getByRole("button", { name: "open a" }));
      await waitFor(() => expect(node()).toBe("A"));

      await user.click(screen.getByRole("button", { name: "push b" }));
      await user.click(screen.getByRole("button", { name: "back" }));

      b.settle("B body");
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(key()).toBe("a");
      expect(node()).toBe("A");
    });
  });

  it("reports a request in flight, and stops when it lands", async () => {
    const a = deferred<string>();
    const user = setup({ a: () => a.promise });

    await user.click(screen.getByRole("button", { name: "open a" }));
    await waitFor(() =>
      expect(screen.getByTestId("pending")).toHaveTextContent("loading"),
    );

    a.settle("A body");
    await waitFor(() =>
      expect(screen.getByTestId("pending")).toHaveTextContent("idle"),
    );
  });
});
