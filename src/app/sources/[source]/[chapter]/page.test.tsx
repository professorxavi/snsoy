import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import type { ChapterDetail } from "@/server/db/queries/sources";
import ChapterPage, { generateMetadata } from "./page";

/**
 * The reader. The renderer has its own tests and the queries have theirs, so
 * what is left to this page is the frame around the prose: the outline, the
 * anchors it points at, and the walk to the next chapter.
 */

vi.mock("@/server/db/queries/sources", () => ({ getChapter: vi.fn() }));
vi.mock("@/server/db/queries/references", () => ({
  resolveReferences: vi.fn().mockResolvedValue({}),
}));
const { getChapter } = await import("@/server/db/queries/sources");

const chapter = (over: Partial<ChapterDetail> = {}): ChapterDetail => ({
  id: 1,
  naturalKey: "bookSection|combat|phb",
  name: "Combat",
  slug: "combat",
  sourceId: "PHB",
  sourceName: "Player's Handbook",
  isAdventure: false,
  page: 189,
  bookId: "PHB",
  ordinalType: "chapter",
  ordinalLabel: "9",
  data: {
    entries: [
      "Combat is a series of rounds.",
      { type: "entries", name: "The Order of Combat", entries: ["Roll for it."] },
      { type: "entries", name: "Making an Attack", entries: ["Swing."] },
    ],
  },
  previous: { name: "Adventuring", slug: "adventuring", ordinalType: "chapter", ordinalLabel: "8" },
  next: { name: "Spellcasting", slug: "spellcasting", ordinalType: "chapter", ordinalLabel: "10" },
  ...over,
}) as ChapterDetail;

const renderPage = async (source = "phb", slug = "combat") =>
  render(await ChapterPage({ params: Promise.resolve({ source, chapter: slug }) }));

/**
 * The outline is a wide-viewport element, and jsdom never evaluates the media
 * query that reveals it — the base `display: none` is all it sees. So it has to
 * be asked for with `hidden`, and matched on its label rather than its
 * accessible name, which computes to nothing while an element is hidden.
 * Whether it is visible at `lg` is a question only a browser can answer.
 */
const outline = () =>
  screen
    .queryAllByRole("navigation", { hidden: true })
    .find((nav) => nav.getAttribute("aria-label") === "In this chapter") ?? null;

const chapterNav = () => screen.queryByRole("navigation", { name: "Chapter" });

beforeEach(() => {
  vi.mocked(getChapter).mockResolvedValue(chapter());
});

describe("a chapter page", () => {
  it("titles itself with the chapter and places it in its book", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Combat" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Chapter 9/)).toBeInTheDocument();
    expect(screen.getByText(/p\. 189/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Player's Handbook" }),
    ).toHaveAttribute("href", "/sources/phb");
  });

  it("carries no chapter number for front matter", async () => {
    vi.mocked(getChapter).mockResolvedValue(
      chapter({ name: "Introduction", ordinalLabel: null, page: null }),
    );
    await renderPage();

    expect(screen.queryByText(/Chapter/)).not.toBeInTheDocument();
  });

  describe("the body", () => {
    /** Prose before the first named section belongs above it, not inside it. */
    it("renders the opening prose before the first section", async () => {
      await renderPage();

      expect(screen.getByText("Combat is a series of rounds.")).toBeInTheDocument();
    });

    it("makes each named section a heading of its own", async () => {
      await renderPage();

      expect(
        screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
      ).toEqual(["The Order of Combat", "Making an Attack"]);
    });

    /**
     * The outline is only useful if its anchors land somewhere. Both sides are
     * derived separately from the same split, so they can drift apart.
     */
    it("anchors every outline entry to a section that exists", async () => {
      const { container } = await renderPage();

      const targets = within(outline()!)
        .getAllByRole("link", { hidden: true })
        .map((link) => link.getAttribute("href")!.slice(1));

      expect(targets).toEqual(["the-order-of-combat", "making-an-attack"]);
      for (const id of targets) {
        expect(container.ownerDocument.getElementById(id)).not.toBeNull();
      }
    });

    it("renders a chapter that is nothing but prose", async () => {
      vi.mocked(getChapter).mockResolvedValue(
        chapter({ data: { entries: ["Just a paragraph."] } } as Partial<ChapterDetail>),
      );
      await renderPage();

      expect(screen.getByText("Just a paragraph.")).toBeInTheDocument();
      expect(outline()).toBeNull();
    });
  });

  describe("walking through the book", () => {
    it("offers both neighbours in the middle of a book", async () => {
      await renderPage();

      expect(
        within(chapterNav()!)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href")),
      ).toEqual(["/sources/phb/adventuring", "/sources/phb/spellcasting"]);
      expect(within(chapterNav()!).getByText("Adventuring")).toBeInTheDocument();
    });

    it("offers only forward from the first chapter", async () => {
      vi.mocked(getChapter).mockResolvedValue(chapter({ previous: null }));
      await renderPage();

      const links = within(chapterNav()!).getAllByRole("link");
      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        "/sources/phb/spellcasting",
      ]);
      expect(within(chapterNav()!).queryByText("Previous")).not.toBeInTheDocument();
    });

    it("offers only backward from the last", async () => {
      vi.mocked(getChapter).mockResolvedValue(chapter({ next: null }));
      await renderPage();

      expect(
        within(chapterNav()!)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href")),
      ).toEqual(["/sources/phb/adventuring"]);
    });

    /** A one-chapter source would otherwise print an empty bordered strip. */
    it("shows nothing at all when there is nowhere to go", async () => {
      vi.mocked(getChapter).mockResolvedValue(
        chapter({ previous: null, next: null }),
      );
      await renderPage();

      expect(chapterNav()).toBeNull();
    });

    /**
     * Neighbours are addressed by slug under the source, never the body they
     * came from — that is what lets a link cross into an inner work.
     */
    it("links a neighbour in a second body under the source", async () => {
      vi.mocked(getChapter).mockResolvedValue(
        chapter({
          sourceId: "MOT",
          next: {
            name: "No Silent Secret",
            slug: "no-silent-secret",
            ordinalType: null,
            ordinalLabel: null,
          },
        }),
      );
      await renderPage("mot");

      expect(
        screen.getByRole("link", { name: /No Silent Secret/ }),
      ).toHaveAttribute("href", "/sources/mot/no-silent-secret");
    });
  });

  it("404s on a chapter that does not exist", async () => {
    vi.mocked(getChapter).mockResolvedValue(null);

    await expect(renderPage("phb", "no-such-chapter")).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });

  describe("metadata", () => {
    it("titles the page with the chapter and its book", async () => {
      const meta = await generateMetadata({
        params: Promise.resolve({ source: "phb", chapter: "combat" }),
      });

      expect(meta.title).toBe("Combat · Player's Handbook");
      expect(meta.description).toBe("Chapter 9, Player's Handbook, p. 189.");
    });

    it("says so when the chapter is missing rather than throwing", async () => {
      vi.mocked(getChapter).mockResolvedValue(null);

      const meta = await generateMetadata({
        params: Promise.resolve({ source: "phb", chapter: "nope" }),
      });

      expect(meta.title).toBe("Not found");
    });
  });
});
