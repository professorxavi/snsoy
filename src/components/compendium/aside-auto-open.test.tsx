import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { AsideAutoOpen } from "./aside-auto-open";
import { AsideProvider, useAside } from "./aside-context";

/**
 * Opening the aside as the page arrives.
 *
 * One assertion matters here and it is about effect ordering, which is why it
 * cannot live anywhere cheaper. React runs effects children-first, so this
 * component sets the provider's dedupe guard *before* the provider's own
 * navigation effect runs and clears it. While that guard was also the
 * stale-response guard, the reply was then thrown away when it landed and the
 * panel sat on its loading skeleton for ever — with `tsc`, every unit test and
 * `next build` all green, and only a browser able to see it.
 *
 * A single `render` reproduces that exactly, because a mount runs the same two
 * effects in the same order that a navigation does.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/search",
}));

/** Shows what the provider is holding, so the assertions read plainly. */
function Panel() {
  const { openKey, node } = useAside();
  return (
    <div>
      <output data-testid="key">{openKey ?? "none"}</output>
      <output data-testid="node">{node}</output>
    </div>
  );
}

describe("AsideAutoOpen", () => {
  it("opens the entity the URL named, and its body arrives", async () => {
    const load = vi.fn(async () => "Goblin stat block");

    render(
      <AsideProvider>
        <Panel />
        <AsideAutoOpen entityKey="monster:mm:goblin" label="Goblin" load={load} />
      </AsideProvider>,
    );

    expect(screen.getByTestId("key")).toHaveTextContent("monster:mm:goblin");

    // The part that regressed: not merely that the panel opened, but that what
    // it opened with survived the commit it opened in.
    await waitFor(() =>
      expect(screen.getByTestId("node")).toHaveTextContent("Goblin stat block"),
    );
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("renders nothing of its own", () => {
    const { container } = render(
      <AsideProvider>
        <AsideAutoOpen entityKey="spell:phb:fireball" load={async () => "x"} />
      </AsideProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  /**
   * Re-rendering must not reopen what the reader has closed. The loader is
   * rebuilt on every render of the page above — it is a bound server function —
   * so this component's effect re-runs freely, and the dedupe guard is what
   * keeps that from being a panel that cannot be dismissed.
   */
  it("does not reload when the page re-renders", async () => {
    const load = vi.fn(async () => "Body");

    const { rerender } = render(
      <AsideProvider>
        <Panel />
        <AsideAutoOpen entityKey="spell:phb:fireball" load={load} />
      </AsideProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("node")).toHaveTextContent("Body"),
    );

    // A fresh loader identity, as a re-rendered server page would supply.
    rerender(
      <AsideProvider>
        <Panel />
        <AsideAutoOpen entityKey="spell:phb:fireball" load={vi.fn(load)} />
      </AsideProvider>,
    );

    expect(load).toHaveBeenCalledTimes(1);
  });
});
