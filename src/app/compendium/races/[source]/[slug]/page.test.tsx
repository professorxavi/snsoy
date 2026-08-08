import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import type { RaceDetail, SubraceDetail } from "@/server/db/queries/races";
import RacePage from "./page";

/**
 * What a race page puts on screen, given a race.
 *
 * The queries have their own smoke test against the seed. What is the page's
 * own is the shape of the document it builds: an outline that reaches every
 * section including each subrace, a trait summary, and the subrace disclosures
 * anchored so inbound links land open.
 *
 * `notFound()` throws by design, which is how the 404 case is asserted.
 */

vi.mock("@/server/db/queries/races", () => ({ getRace: vi.fn() }));
vi.mock("@/server/db/queries/references", () => ({
  resolveReferences: vi.fn(),
}));

const { getRace } = await import("@/server/db/queries/races");
const { resolveReferences } = await import("@/server/db/queries/references");

const subrace = (
  slug: string,
  name: string,
  over: Partial<SubraceDetail> = {},
): SubraceDetail =>
  ({
    slug,
    name,
    sourceId: "PHB",
    sourceName: "Player's Handbook",
    data: { entries: [`${name} traits.`] },
    ...over,
  }) as SubraceDetail;

const race = (over: Partial<RaceDetail> = {}): RaceDetail =>
  ({
    name: "Dwarf",
    slug: "dwarf",
    sourceId: "PHB",
    sourceName: "Player's Handbook",
    size: ["M"],
    speed: 25,
    abilityBonuses: [{ con: 2 }],
    fluff: null,
    data: {
      entries: [
        "Bold and hardy.",
        { type: "entries", name: "Age", entries: ["Dwarves mature slowly."] },
        { type: "entries", name: "Alignment", entries: ["Most are lawful."] },
      ],
    },
    subraces: [subrace("hill", "Hill"), subrace("mountain", "Mountain")],
    ...over,
  }) as RaceDetail;

const renderPage = async (over: Partial<RaceDetail> = {}) => {
  vi.mocked(getRace).mockResolvedValue(race(over));
  return render(
    await RacePage({ params: Promise.resolve({ source: "phb", slug: "dwarf" }) }),
  );
};

/**
 * Found by selector rather than by role.
 *
 * The outline column is behind a `lg` breakpoint, and jsdom does not evaluate
 * media queries — so it computes to `display: none` here and Testing Library
 * correctly drops it out of the accessibility tree. On a real desktop viewport
 * it is visible; that it is *placed* on the trailing edge and stays sticky is a
 * layout question, and belongs to the browser tier.
 */
const outlineNav = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('nav[aria-label="On this page"]');

const outlineLinks = (container: HTMLElement) => [
  ...outlineNav(container)!.querySelectorAll("a"),
];

const outlineLink = (container: HTMLElement, label: string) =>
  outlineLinks(container).find((link) => link.textContent === label);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveReferences).mockResolvedValue({});
});

describe("a race page", () => {
  it("titles the page with the race", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Dwarf", level: 1 }),
    ).toBeInTheDocument();
  });

  it("links back to the book that printed it", async () => {
    await renderPage();

    expect(
      screen.getByRole("link", { name: /Player's Handbook/ }),
    ).toHaveAttribute("href", "/sources/phb");
  });

  it("summarises the traits a reader compares races on", async () => {
    await renderPage();

    const main = screen.getByRole("main").textContent!;

    expect(main).toContain("Medium");
    expect(main).toContain("25 ft");
  });

  it("404s on a race that does not exist", async () => {
    vi.mocked(getRace).mockResolvedValue(null);

    await expect(
      RacePage({ params: Promise.resolve({ source: "phb", slug: "nope" }) }),
    ).rejects.toThrow();
  });

  describe("the outline", () => {
    it("lists each section of the race's own text", async () => {
      const { container } = await renderPage();

      expect(outlineLink(container, "Age")).toBeDefined();
      expect(outlineLink(container, "Alignment")).toBeDefined();
    });

    it("lists every subrace, nested under a Subraces entry", async () => {
      const { container } = await renderPage();

      expect(outlineLink(container, "Subraces")).toBeDefined();
      expect(outlineLink(container, "Hill")).toHaveAttribute("href", "#hill");
      expect(outlineLink(container, "Mountain")).toHaveAttribute(
        "href",
        "#mountain",
      );
    });

    /**
     * Every outline link is a fragment, and a fragment that lands nowhere
     * scrolls the reader to the top of the page with no explanation.
     */
    it("points every entry at an anchor that exists", async () => {
      const { container } = await renderPage();

      const targets = outlineLinks(container).map((link) =>
        link.getAttribute("href")!.replace(/^#/, ""),
      );

      expect(targets.length).toBeGreaterThan(0);
      for (const id of targets) {
        expect(container.querySelector(`#${CSS.escape(id)}`)).not.toBeNull();
      }
    });

    it("stays away when a race has no sections and no subraces", async () => {
      const { container } = await renderPage({
        data: { entries: ["Just a paragraph."] },
        subraces: [],
      });

      expect(outlineNav(container)).toBeNull();
    });
  });

  describe("the subraces", () => {
    it("renders one collapsed disclosure per subrace", async () => {
      const { container } = await renderPage();

      const details = container.querySelectorAll("details");

      expect(details).toHaveLength(2);
      expect([...details].every((el) => !el.open)).toBe(true);
    });

    it("names the book each subrace came from", async () => {
      const { container } = await renderPage({
        subraces: [
          subrace("hill", "Hill"),
          subrace("mark-of-warding", "Mark of Warding", {
            sourceId: "ERLW",
            sourceName: "Eberron: Rising from the Last War",
          }),
        ],
      });

      expect(container.textContent).toContain(
        "Eberron: Rising from the Last War",
      );
    });

    it("omits the whole section when a race has none", async () => {
      const { container } = await renderPage({ subraces: [] });

      expect(container.querySelectorAll("details")).toHaveLength(0);
    });

    /** The Tiefling case — thirteen of these, all server-rendered. */
    it("scales to a race with many subraces", async () => {
      const many = Array.from({ length: 13 }, (_, i) =>
        subrace(`sub-${i}`, `Variant ${i}`),
      );
      const { container } = await renderPage({ subraces: many });

      expect(container.querySelectorAll("details")).toHaveLength(13);
      expect(
        outlineLinks(container).filter((link) =>
          /^Variant/.test(link.textContent!),
        ),
      ).toHaveLength(13);
    });
  });

  /**
   * One resolve for the page, parent and subraces together. A Tiefling
   * resolving per-subrace would make fourteen round trips to render one page.
   */
  it("resolves every reference on the page in a single query", async () => {
    await renderPage({
      subraces: Array.from({ length: 13 }, (_, i) =>
        subrace(`sub-${i}`, `Variant ${i}`),
      ),
    });

    expect(resolveReferences).toHaveBeenCalledTimes(1);
  });
});
