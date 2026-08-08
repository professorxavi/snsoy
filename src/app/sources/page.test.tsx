import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import type { SourceListItem } from "@/server/db/queries/sources";
import SourcesPage from "./page";

/**
 * What the index puts on screen, given rows.
 *
 * The queries have their own smoke test against the seeded database; this
 * covers the part that is the page's own — which rows survive the `kind`
 * filter, and what a card says about a source.
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
  source({
    id: "LMoP",
    name: "Lost Mine of Phandelver",
    isAdventure: true,
    chapterCount: 5,
  }),
];

const renderPage = async (params: Record<string, string> = {}) =>
  render(await SourcesPage({ searchParams: Promise.resolve(params) }));

/** The cards, which are the only links out of the page to a single source. */
const cards = () =>
  screen
    .getAllByRole("link")
    .filter((link) => /^\/sources\/[^/?#]+$/.test(link.getAttribute("href")!));

beforeEach(() => {
  vi.mocked(listSources).mockResolvedValue(SOURCES);
});

describe("the source index", () => {
  it("gives every source a card linking to it", async () => {
    await renderPage();

    expect(cards().map((link) => link.getAttribute("href"))).toEqual([
      "/sources/phb",
      "/sources/dmg",
      "/sources/lmop",
    ]);
    expect(screen.getByText("Player's Handbook")).toBeInTheDocument();
  });

  it("shows the year and how much there is to read", async () => {
    await renderPage();

    expect(within(cards()[0]!).getByText("2014 · 16 chapters")).toBeInTheDocument();
  });

  it("counts a single chapter in the singular", async () => {
    vi.mocked(listSources).mockResolvedValue([
      source({ id: "Screen", name: "DM Screen", chapterCount: 1 }),
    ]);
    await renderPage();

    expect(within(cards()[0]!).getByText("2014 · 1 chapter")).toBeInTheDocument();
  });

  /**
   * A source can be cited before its body is loaded. The card still has to
   * render — with nothing where the chapter count would be, rather than "0
   * chapters" or a stray separator.
   */
  it("says nothing about chapters when there are none", async () => {
    vi.mocked(listSources).mockResolvedValue([
      source({ id: "VD", name: "Vecna Dossier", chapterCount: 0 }),
    ]);
    await renderPage();

    const card = within(cards()[0]!);
    expect(card.getByText("2014")).toBeInTheDocument();
    expect(card.queryByText(/chapter/)).not.toBeInTheDocument();
  });

  it("renders a source that has no cover", async () => {
    vi.mocked(listSources).mockResolvedValue([
      source({ id: "VD", name: "Vecna Dossier", coverPath: null }),
    ]);
    await renderPage();

    expect(cards()).toHaveLength(1);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  describe("the kind filter", () => {
    it("shows everything by default", async () => {
      await renderPage();

      expect(cards()).toHaveLength(3);
      expect(
        screen.getByRole("link", { name: "All" }),
      ).toHaveAttribute("aria-current", "page");
    });

    it("narrows to books", async () => {
      await renderPage({ kind: "books" });

      expect(cards().map((link) => link.getAttribute("href"))).toEqual([
        "/sources/phb",
        "/sources/dmg",
      ]);
    });

    it("narrows to adventures", async () => {
      await renderPage({ kind: "adventures" });

      expect(cards().map((link) => link.getAttribute("href"))).toEqual([
        "/sources/lmop",
      ]);
    });

    it("marks the active option and clears it on the way back to all", async () => {
      await renderPage({ kind: "books" });

      const books = screen.getByRole("link", { name: "Books" });
      expect(books).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("link", { name: "All" })).toHaveAttribute(
        "href",
        "/sources",
      );
    });

    /** An unrecognised value filters nothing out rather than emptying the page. */
    it("ignores a kind it does not know", async () => {
      await renderPage({ kind: "nonsense" });

      expect(cards()).toHaveLength(3);
    });
  });
});
