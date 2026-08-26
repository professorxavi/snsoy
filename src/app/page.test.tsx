import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import type { SourceListItem } from "@/server/db/queries/sources";
import Home from "./page";

/**
 * The landing page is a masthead, two doors and a shelf.
 *
 * Worth a test only because the doors are the entry point to everything else:
 * a card that stops linking, or links somewhere that no longer exists, strands
 * the whole product behind a URL the reader has to already know. A third card
 * pointed at `/characters` for months and 404'd — the builder is still Phase 7
 * and does not need a door before it has a room.
 *
 * The shelf reads the source list, so the query is mocked here exactly as the
 * source index's own test mocks it: what rows come back is that query's
 * business, and this covers what the page does with them.
 */

vi.mock("@/server/db/queries/sources", () => ({ listSources: vi.fn() }));
const { listSources } = await import("@/server/db/queries/sources");

const source = (over: Partial<SourceListItem>): SourceListItem => ({
  id: "PHB",
  name: "Player's Handbook",
  group: "core",
  published: "2014-08-19",
  coverPath: "covers/PHB.webp",
  isAdventure: false,
  chapterCount: 16,
  ...over,
});

const SOURCES = [
  source({}),
  source({ id: "DMG", name: "Dungeon Master's Guide" }),
  source({ id: "MM", name: "Monster Manual" }),
];

const renderPage = async () => render(await Home());

/** A door, found by the title it carries. */
const door = (title: string) => screen.getByText(title).closest("a")!;

beforeEach(() => {
  vi.mocked(listSources).mockResolvedValue(SOURCES);
});

describe("the landing page", () => {
  it("names the product", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { name: /Sword & Sorcery over Yonder/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("offers a way into each of the two areas", async () => {
    await renderPage();

    expect(door("Compendium")).toHaveAttribute("href", "/compendium");
    expect(door("Sources")).toHaveAttribute("href", "/sources");
  });

  it("gives every card a title and a description", async () => {
    await renderPage();

    for (const title of ["Compendium", "Sources"]) {
      const card = door(title);
      expect(card).toBeInTheDocument();
      // Title plus body — a card with no body is a card that says nothing.
      expect(card.textContent!.length).toBeGreaterThan(title.length + 40);
    }
  });
});

describe("the shelf", () => {
  /**
   * Nothing is printed under a cover, so the link's accessible name is the
   * only thing naming it. A shelf of unlabelled images would be a row of
   * destinations a screen reader cannot tell apart.
   */
  it("links to every source, named", async () => {
    await renderPage();

    for (const item of SOURCES) {
      expect(screen.getByRole("link", { name: item.name })).toHaveAttribute(
        "href",
        `/sources/${item.id.toLowerCase()}`,
      );
    }
  });

  /**
   * The sources page files promotional one-shots under Odds and Ends and the
   * Sage Advice Compendium under Errata and Rulings. A shelf that showed them
   * among the first twelve covers would misrepresent what the instance holds.
   */
  it("keeps the banded sources off the shelf", async () => {
    vi.mocked(listSources).mockResolvedValue([
      ...SOURCES,
      source({ id: "OGA", name: "One Grung Above", group: "supplement-alt" }),
      source({ id: "SAC", name: "Sage Advice Compendium", group: "errata" }),
    ]);

    await renderPage();

    const named = (name: string) => screen.queryByRole("link", { name });

    expect(named("One Grung Above")).toBeNull();
    expect(named("Sage Advice Compendium")).toBeNull();
    expect(named("Player's Handbook")).not.toBeNull();
  });

  it("renders nothing when there are no sources", async () => {
    vi.mocked(listSources).mockResolvedValue([]);
    await renderPage();

    expect(screen.queryByRole("heading", { name: /on the shelf/i })).toBeNull();
  });
});
