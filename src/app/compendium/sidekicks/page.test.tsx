import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import type { SidekickListItem } from "@/server/db/queries/classes";
import SidekicksPage from "./page";

/**
 * The sidekicks index.
 *
 * Three rows, and the only thing worth asserting about them is where they go.
 * A sidekick is a `class` row: it has no route of its own and opens on the
 * class reader, which is where its page has always been and where an inbound
 * link from book text still points. A second segment for the same entity type
 * would be a second URL for one page, and the index would be the only thing
 * that knew which was canonical.
 */

vi.mock("@/server/db/queries/classes", () => ({ listSidekicks: vi.fn() }));
const { listSidekicks } = await import("@/server/db/queries/classes");

const SIDEKICKS = [
  {
    id: "1",
    name: "Expert Sidekick",
    slug: "expert-sidekick",
    sourceId: "TCE",
    sourceName: "Tasha's Cauldron of Everything",
    page: 142,
    hitDie: null,
    casterProgression: null,
    spellcastingAbility: null,
    savingThrows: null,
    subclassTitle: null,
    subclassCount: 0,
  },
  {
    id: "2",
    name: "Spellcaster Sidekick",
    slug: "spellcaster-sidekick",
    sourceId: "TCE",
    sourceName: "Tasha's Cauldron of Everything",
    page: 144,
    hitDie: null,
    casterProgression: "artificer",
    spellcastingAbility: null,
    savingThrows: null,
    subclassTitle: null,
    subclassCount: 0,
  },
] as unknown as SidekickListItem[];

const renderPage = async () => render(await SidekicksPage());

beforeEach(() => {
  vi.mocked(listSidekicks).mockResolvedValue(SIDEKICKS);
});

describe("the sidekicks index", () => {
  it("lists every sidekick", async () => {
    await renderPage();

    expect(screen.getAllByRole("link")).toHaveLength(SIDEKICKS.length);
    expect(screen.getByText("Expert Sidekick")).toBeInTheDocument();
  });

  it("opens each one on the class reader, not a route of its own", async () => {
    await renderPage();

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/compendium\/classes\//);
    }
    expect(
      screen.getByRole("link", { name: /Expert Sidekick/ }),
    ).toHaveAttribute("href", "/compendium/classes/tce/expert-sidekick");
  });

  /**
   * Two of the three carry no hit die and no saving throws at all, so the line
   * under the name has to hold up with almost nothing in it.
   */
  it("names the book when there is nothing else to say", async () => {
    await renderPage();

    expect(
      screen.getByRole("link", { name: /Expert Sidekick/ }),
    ).toHaveTextContent("Tasha's Cauldron of Everything");
    expect(
      screen.getByRole("link", { name: /Spellcaster Sidekick/ }),
    ).toHaveTextContent("Artificer casting · Tasha's Cauldron of Everything");
  });
});
