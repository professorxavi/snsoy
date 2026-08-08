import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import type { ChapterListItem, SourceDetail } from "@/server/db/queries/sources";
import SourcePage, { generateMetadata } from "./page";

/**
 * One book's page: its chapter list, and the two shapes that are not a plain
 * list of chapters — a source carrying a second body, and a source carrying no
 * body at all.
 */

vi.mock("@/server/db/queries/sources", () => ({ getSource: vi.fn() }));
const { getSource } = await import("@/server/db/queries/sources");

const chapter = (over: Partial<ChapterListItem>): ChapterListItem => ({
  name: "Combat",
  slug: "combat",
  page: 189,
  bookId: "PHB",
  ordinalType: "chapter",
  ordinalLabel: "9",
  headers: null,
  ...over,
});

const book = (over: Partial<SourceDetail> = {}): SourceDetail => ({
  id: "PHB",
  name: "Player's Handbook",
  group: "core",
  published: "2014-08-19",
  author: "Wizards of the Coast",
  coverPath: "covers/PHB.webp",
  isAdventure: false,
  chapters: [
    chapter({ name: "Introduction", slug: "introduction", ordinalLabel: null }),
    chapter({}),
    chapter({
      name: "Conditions",
      slug: "conditions",
      ordinalType: "appendix",
      ordinalLabel: "A",
    }),
  ],
  ...over,
});

const renderPage = async (source = "phb") =>
  render(await SourcePage({ params: Promise.resolve({ source }) }));

const chapterLinks = () =>
  screen
    .queryAllByRole("link")
    .filter((link) =>
      /^\/sources\/[^/?#]+\/[^/?#]+$/.test(link.getAttribute("href")!),
    );

beforeEach(() => {
  vi.mocked(getSource).mockResolvedValue(book());
});

describe("a source page", () => {
  it("names the book and what kind of book it is", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Player's Handbook" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sourcebook")).toBeInTheDocument();
  });

  it("calls an adventure an adventure", async () => {
    vi.mocked(getSource).mockResolvedValue(book({ isAdventure: true }));
    await renderPage();

    expect(screen.getByText("Adventure")).toBeInTheDocument();
  });

  it("prints when it came out, who wrote it and how long it is", async () => {
    await renderPage();

    expect(
      screen.getByText("August 2014 · Wizards of the Coast · 3 chapters"),
    ).toBeInTheDocument();
  });

  it("leaves out metadata the source does not carry", async () => {
    vi.mocked(getSource).mockResolvedValue(
      book({ published: null, author: null }),
    );
    await renderPage();

    expect(screen.getByText("3 chapters")).toBeInTheDocument();
  });

  describe("the chapter list", () => {
    it("links every chapter by slug", async () => {
      await renderPage();

      expect(chapterLinks().map((link) => link.getAttribute("href"))).toEqual([
        "/sources/phb/introduction",
        "/sources/phb/combat",
        "/sources/phb/conditions",
      ]);
    });

    /**
     * The printed numbering, not a running count: appendices carry letters and
     * front matter carries nothing, so the reader holding the book finds the
     * same chapter under the same label.
     */
    it("keeps the book's own numbering", async () => {
      await renderPage();

      expect(within(chapterLinks()[0]!).queryByText(/\S/)?.textContent).toBe(
        "Introduction",
      );
      expect(within(chapterLinks()[1]!).getByText("9")).toBeInTheDocument();
      expect(within(chapterLinks()[2]!).getByText("A")).toBeInTheDocument();
    });

    it("previews the headings inside a chapter", async () => {
      vi.mocked(getSource).mockResolvedValue(
        book({
          chapters: [chapter({ headers: ["Attack Rolls", "Cover", "Damage"] })],
        }),
      );
      await renderPage();

      expect(
        screen.getByText("Attack Rolls · Cover · Damage"),
      ).toBeInTheDocument();
    });
  });

  describe("a source with a second body", () => {
    const twoBodies = book({
      id: "MOT",
      name: "Mythic Odysseys of Theros",
      chapters: [
        chapter({ bookId: "MOT", name: "Credits", slug: "credits", ordinalLabel: null }),
        chapter({
          bookId: "MOT-NSS",
          name: "No Silent Secret",
          slug: "no-silent-secret",
          ordinalLabel: null,
        }),
      ],
    });

    /** Without headings the inner work's chapters read as more of the book. */
    it("prints each body under its own heading", async () => {
      vi.mocked(getSource).mockResolvedValue(twoBodies);
      await renderPage("mot");

      expect(
        screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
      ).toEqual(["Mythic Odysseys of Theros", "No Silent Secret"]);
    });

    it("gives an ordinary book no headings to ignore", async () => {
      await renderPage();

      expect(screen.queryAllByRole("heading", { level: 2 })).toEqual([]);
    });
  });

  describe("a source with no body", () => {
    beforeEach(() => {
      vi.mocked(getSource).mockResolvedValue(
        book({ id: "TftYP", name: "TftYP", chapters: [], coverPath: null }),
      );
    });

    /** Reachable only from an entity citing it, so it explains itself. */
    it("says why it is empty instead of showing an empty list", async () => {
      await renderPage("tftyp");

      expect(
        screen.getByText(/No chapters have been loaded/),
      ).toBeInTheDocument();
      expect(chapterLinks()).toEqual([]);
    });

    /** A count of zero, or the separator that would precede it, both read as bugs. */
    it("drops the chapter count from the metadata line", async () => {
      await renderPage("tftyp");

      expect(
        screen.getByText("August 2014 · Wizards of the Coast"),
      ).toBeInTheDocument();
    });
  });

  it("404s on a source that does not exist", async () => {
    vi.mocked(getSource).mockResolvedValue(null);

    await expect(renderPage("no-such-book")).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  describe("metadata", () => {
    it("titles the page with the book", async () => {
      const meta = await generateMetadata({
        params: Promise.resolve({ source: "phb" }),
      });

      expect(meta.title).toBe("Player's Handbook");
      expect(meta.description).toContain("2014");
    });

    it("says so when the source is missing rather than throwing", async () => {
      vi.mocked(getSource).mockResolvedValue(null);

      const meta = await generateMetadata({
        params: Promise.resolve({ source: "no-such-book" }),
      });

      expect(meta.title).toBe("Not found");
    });
  });
});
