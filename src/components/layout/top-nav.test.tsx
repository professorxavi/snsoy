import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/test/render";
import { TopNav } from "./top-nav";

/**
 * The top bar's mobile drawer.
 *
 * Below `md` the bar's nav is `display: none`, and until this drawer existed
 * nothing replaced it — the compendium was unreachable from a phone except
 * through the wordmark and a link on the home page. jsdom cannot see the
 * breakpoint, so what is asserted here is the drawer's behaviour: it carries
 * the same links, and following one closes it.
 *
 * That last part is the only line of state in the component and the reason it
 * is controlled at all. A link is not a close button: it navigates without
 * unmounting the bar, so an uncontrolled drawer would still be sitting over the
 * page it had just been asked for.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/compendium",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

/**
 * The router is mocked, so a link click reaches jsdom, which cannot navigate
 * and says so on stderr. Swallowing the default keeps that out of the suite's
 * output without changing what the click does to the drawer.
 */
const swallow = (event: Event) => event.preventDefault();

beforeEach(() => window.addEventListener("click", swallow));
afterEach(() => window.removeEventListener("click", swallow));

describe("TopNav", () => {
  it("keeps the drawer shut until it is asked for", () => {
    render(<TopNav />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on the menu button, carrying the same links as the bar", async () => {
    const user = userEvent.setup();
    render(<TopNav />);

    await user.click(screen.getByRole("button", { name: "Menu" }));

    const drawer = await screen.findByRole("dialog");
    expect(drawer).toHaveTextContent("Compendium");
    expect(drawer).toHaveTextContent("Sources");
  });

  it("marks the section being read, as the bar does", async () => {
    const user = userEvent.setup();
    render(<TopNav />);

    await user.click(screen.getByRole("button", { name: "Menu" }));
    const drawer = await screen.findByRole("dialog");

    const compendium = within(drawer).getByRole("link", { name: "Compendium" });
    expect(compendium).toHaveAttribute("aria-current", "page");
    expect(
      within(drawer).getByRole("link", { name: "Sources" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("closes when a link is followed", async () => {
    const user = userEvent.setup();
    render(<TopNav />);

    await user.click(screen.getByRole("button", { name: "Menu" }));
    const drawer = await screen.findByRole("dialog");

    await user.click(within(drawer).getByRole("link", { name: "Sources" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
