import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Suggestion } from "@/server/db/queries/search";
import { render, screen, userEvent, waitFor } from "@/test/render";
import { SearchBox } from "./search-box";

/**
 * The top bar's typeahead.
 *
 * This is the app's first client-side data fetching, and the three things worth
 * pinning are the three that a network round trip on every keystroke brings
 * with it: how many requests a burst of typing costs, what happens when replies
 * arrive out of order, and whether the form underneath still works when none of
 * it does. None is observable on the server and all three regress silently.
 *
 * Ranking is not asserted here — `suggestEntities` owns that, against the seed.
 * What this file cares about is that whatever came back is what gets shown.
 */

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Fireball",
    entityType: "spell",
    sourceId: "PHB",
    slug: "fireball",
    href: "/compendium/spells/phb/fireball",
    parentName: null,
    ...overrides,
  };
}

/** Replies with whatever the caller sets up, echoing the query as the route does. */
function mockFetch(
  handler: (q: string) => Suggestion[] | Promise<Suggestion[]>,
) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input), "http://localhost");
    const q = url.searchParams.get("q") ?? "";
    const suggestions = await handler(q);
    return {
      ok: true,
      json: async () => ({ q, suggestions }),
    } as Response;
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const typeInto = async (text: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox"));
  await user.keyboard(text);
  return user;
};

/**
 * Real timers throughout. The debounce is 150ms, so waiting it out costs
 * milliseconds — and fake timers have to be threaded through `userEvent`, which
 * makes every interaction in the file depend on a detail only two assertions
 * care about.
 */
const settle = (ms = DEBOUNCE_MS * 3) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Mirrors `DEBOUNCE_MS` in the component, which is not exported. */
const DEBOUNCE_MS = 150;

beforeEach(() => {
  push.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SearchBox", () => {
  describe("before anything is typed", () => {
    /**
     * The form is the feature; the dropdown is an accelerator over it. Without
     * JavaScript, before hydration, or when the request fails, this is what
     * still has to work.
     */
    it("is a GET form pointing at the results page", () => {
      render(<SearchBox />);

      const form = screen.getByRole("search");
      expect(form).toHaveAttribute("action", "/search");
      expect(form).toHaveAttribute("method", "get");
      expect(screen.getByRole("combobox")).toHaveAttribute("name", "q");
    });

    it("claims no list until there is one", () => {
      render(<SearchBox />);

      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(screen.queryByRole("listbox")).toBeNull();
    });
  });

  describe("asking for suggestions", () => {
    it("shows what came back", async () => {
      mockFetch(() => [
        suggestion(),
        suggestion({ id: "2", name: "Wand of Fireballs", entityType: "item" }),
      ]);
      render(<SearchBox />);

      await typeInto("fireball");

      const options = await screen.findAllByRole("option");
      expect(options.map((option) => option.textContent)).toEqual([
        "FireballSpell",
        "Wand of FireballsMagic Item",
      ]);
      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    /** A fragment's name means nothing alone, in the dropdown as on the page. */
    it("qualifies a fragment with its parent", async () => {
      mockFetch(() => [
        suggestion({
          name: "Sneak Attack",
          entityType: "classFeature",
          parentName: "Rogue",
        }),
      ]);
      render(<SearchBox />);

      await typeInto("sneak attack");

      expect(await screen.findByRole("option")).toHaveTextContent(
        "Sneak Attack — Rogue",
      );
    });

    /**
     * Below the minimum the server refuses to answer, so asking would be a
     * round trip for a guaranteed empty list — and, on the server, a scan of
     * every name in the corpus.
     */
    it("does not ask for a query too short to answer", async () => {
      const fetchMock = mockFetch(() => []);
      render(<SearchBox />);

      await typeInto("f");
      await settle();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    /** A burst of typing is one question, not one per letter. */
    it("debounces a burst of typing into a single request", async () => {
      const fetchMock = mockFetch(() => [suggestion()]);
      render(<SearchBox />);

      await typeInto("fireball");
      await settle();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]![0])).toContain("q=fireball");
    });

    /**
     * The reason every reply echoes its query. `AbortController` asks a request
     * to stop, which is not a guarantee it will — so a slow first reply can
     * still arrive after a fast second one, and without the echo it would
     * overwrite it.
     */
    it("ignores a reply that answers an older query", async () => {
      const slow = [suggestion({ id: "slow", name: "Fire Bolt" })];
      const fast = [suggestion({ id: "fast", name: "Fireball" })];

      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL | Request) => {
          const q = new URL(String(input), "http://localhost").searchParams.get(
            "q",
          )!;
          // The stale one resolves last, which is the whole point.
          if (q === "fire") await new Promise((r) => setTimeout(r, 50));
          return {
            ok: true,
            json: async () => ({ q, suggestions: q === "fire" ? slow : fast }),
          } as Response;
        }),
      );

      render(<SearchBox />);
      const user = await typeInto("fire");
      await user.keyboard("ball");

      await waitFor(() =>
        expect(screen.getByRole("option")).toHaveTextContent("Fireball"),
      );

      // Long enough for the stale reply to land and be discarded.
      await settle();
      expect(screen.getAllByRole("option")).toHaveLength(1);
      expect(screen.getByRole("option")).toHaveTextContent("Fireball");
    });

    /** Deleting back below the minimum takes the list away with it. */
    it("drops suggestions that no longer answer what is typed", async () => {
      mockFetch(() => [suggestion()]);
      render(<SearchBox />);

      const user = await typeInto("fireball");
      await screen.findByRole("option");

      await user.clear(screen.getByRole("combobox"));

      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    });

    /** A failed request must not break the field it is decorating. */
    it("stays usable when the request fails", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
      render(<SearchBox />);

      await typeInto("fireball");

      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.getByRole("combobox")).toHaveValue("fireball");
    });
  });

  describe("choosing one", () => {
    /**
     * A creature has no page, so its canonical URL is a 404 — the destination
     * is the results page with the entity already open.
     */
    it("navigates to the results page with the entity pre-opened", async () => {
      mockFetch(() => [
        suggestion({ name: "Goblin", entityType: "monster", sourceId: "MM", slug: "goblin" }),
      ]);
      render(<SearchBox />);

      const user = await typeInto("goblin");
      await user.click(await screen.findByRole("option"));

      expect(push).toHaveBeenCalledWith(
        "/search?q=Goblin&open=monster%3Amm%3Agoblin",
      );
    });

    it("moves through the list with the arrow keys and opens on Enter", async () => {
      mockFetch(() => [
        suggestion({ id: "1", name: "Fireball" }),
        suggestion({ id: "2", name: "Fire Bolt", slug: "fire-bolt" }),
      ]);
      render(<SearchBox />);

      const user = await typeInto("fire");
      await screen.findAllByRole("option");

      await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

      expect(push).toHaveBeenCalledWith(
        "/search?q=Fire%20Bolt&open=spell%3Aphb%3Afire-bolt",
      );
    });

    /** The highlighted row has to be announced, not merely tinted. */
    it("points aria-activedescendant at the highlighted row", async () => {
      mockFetch(() => [suggestion(), suggestion({ id: "2", name: "Fire Bolt" })]);
      render(<SearchBox />);

      const user = await typeInto("fire");
      await screen.findAllByRole("option");

      const combobox = screen.getByRole("combobox");
      expect(combobox).not.toHaveAttribute("aria-activedescendant");

      await user.keyboard("{ArrowDown}");
      const active = screen.getAllByRole("option")[0]!;
      expect(active).toHaveAttribute("aria-selected", "true");
      expect(combobox).toHaveAttribute("aria-activedescendant", active.id);
    });

    /**
     * Arrowing off the end returns to the field with what was typed, rather
     * than sticking on the last row — otherwise there is no way back to the
     * plain search except the mouse.
     */
    it("wraps off the end of the list back to the field", async () => {
      mockFetch(() => [suggestion(), suggestion({ id: "2", name: "Fire Bolt" })]);
      render(<SearchBox />);

      const user = await typeInto("fire");
      await screen.findAllByRole("option");

      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

      expect(screen.getByRole("combobox")).not.toHaveAttribute(
        "aria-activedescendant",
      );
    });

    /**
     * With nothing highlighted, Enter is the form's own submit — the behaviour
     * that existed before this component and still has to.
     */
    it("leaves the form to submit when nothing is highlighted", async () => {
      mockFetch(() => [suggestion()]);
      render(<SearchBox />);

      const user = await typeInto("fireball");
      await screen.findByRole("option");
      await user.keyboard("{Enter}");

      expect(push).not.toHaveBeenCalled();
    });

    it("closes on Escape without clearing what was typed", async () => {
      mockFetch(() => [suggestion()]);
      render(<SearchBox />);

      const user = await typeInto("fireball");
      await screen.findByRole("option");

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.getByRole("combobox")).toHaveValue("fireball");
    });

    it("offers a way through to the full results", async () => {
      mockFetch(() => [suggestion()]);
      render(<SearchBox />);

      await typeInto("fireball");
      await screen.findByRole("option");

      expect(
        screen.getByRole("link", { name: /See all results/ }),
      ).toHaveAttribute("href", "/search?q=fireball");
    });
  });
});
