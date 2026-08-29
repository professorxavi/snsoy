import { beforeEach, describe, expect, it, vi } from "vitest";
import { AsideProvider } from "@/components/compendium/aside-context";
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
    // Both lists key on this rather than the slug, which is unique only within
    // a source — see "two subraces that share a slug".
    naturalKey: `subrace|${slug}|dwarf|phb|${(
      (over.sourceId as string | undefined) ?? "PHB"
    ).toLowerCase()}`,
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

/**
 * Wrapped in the aside's provider: a race's traits cite spells, and those open
 * beside the page rather than leaving it, through a wrapper that reads context.
 */
const renderPage = async (over: Partial<RaceDetail> = {}) => {
  vi.mocked(getRace).mockResolvedValue(race(over));
  return render(
    <AsideProvider>
      {await RacePage({
        params: Promise.resolve({ source: "phb", slug: "dwarf" }),
      })}
    </AsideProvider>,
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

  /**
   * A race's flavour text lives in fluff, not in its own entries: 98 of the 134
   * races carry prose only there, and their `data.entries` are nothing but
   * named traits. Reading `data.entries` alone opened most race pages straight
   * into "Flight", and left the aside — which does read fluff — saying more
   * about a race than its own page did.
   */
  describe("the opening prose", () => {
    it("prints the flavour text out of fluff", async () => {
      await renderPage({
        fluff: { entries: ["A winged people of the Elemental Plane of Air."] },
      });

      expect(
        screen.getByText(/winged people of the Elemental Plane/),
      ).toBeInTheDocument();
    });

    /**
     * Added to the race's own opening, not swapped for it. Four races carry a
     * line of their own as well, and it is a rules note rather than a second
     * telling of the flavour.
     */
    it("keeps the race's own opening line alongside it", async () => {
      await renderPage({
        fluff: { entries: ["Flavour from the book."] },
      });

      expect(screen.getByText(/Flavour from the book/)).toBeInTheDocument();
      expect(screen.getByText(/Bold and hardy/)).toBeInTheDocument();
    });

    it("manages without fluff at all", async () => {
      await renderPage();

      expect(screen.getByText(/Bold and hardy/)).toBeInTheDocument();
    });

    /** Fluff's own named sections are art and lore headings, not traits. */
    it("takes only the prose, leaving fluff's named sections out", async () => {
      await renderPage({
        fluff: {
          entries: [
            "Flavour from the book.",
            { type: "entries", name: "Aarakocra Names", entries: ["Krik."] },
          ],
        },
      });

      expect(screen.getByText(/Flavour from the book/)).toBeInTheDocument();
      expect(screen.queryByText("Aarakocra Names")).not.toBeInTheDocument();
    });
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

  /**
   * From Van Richten's onwards a race states neither an ability spread nor its
   * languages, deferring to a rule the books print once. 46 races across seven
   * books showed neither.
   */
  describe("lineage races", () => {
    it("shows the ability choice the race defers to", async () => {
      const { container } = await renderPage({
        ability: null,
        lineage: "VRGR",
      });

      expect(container.textContent).toContain(
        "+2 and +1 to two of your choice",
      );
    });

    it("shows the languages it is owed, as a trait like any other", async () => {
      const { container } = await renderPage({
        lineage: "VRGR",
        data: {
          entries: [{ type: "entries", name: "Flight", entries: ["Fly."] }],
        },
      });
      const headings = [...container.querySelectorAll("h2")].map(
        (h) => h.textContent,
      );

      expect(headings).toContain("Languages");
      // Last, after the race's own.
      expect(headings.indexOf("Languages")).toBeGreaterThan(
        headings.indexOf("Flight"),
      );
    });

    it("leaves a race that states its own alone", async () => {
      const { container } = await renderPage({
        lineage: null,
        data: {
          entries: [{ type: "entries", name: "Flight", entries: ["Fly."] }],
        },
      });
      const headings = [...container.querySelectorAll("h2")].map(
        (h) => h.textContent,
      );

      expect(headings).not.toContain("Languages");
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

    /**
     * A subrace that is only its numbers says nothing about what it *is*, which
     * is the half a reader is choosing between: Glasya grants magic for
     * committing heists, Zariel's are built for battle.
     */
    it("opens a subrace with what the books say it is", async () => {
      const { container } = await renderPage({
        subraces: [
          subrace("glasya", "Glasya", {
            ability: [{ cha: 2, dex: 1 }],
            fluff: {
              entries: [
                "Glasya, Hell's criminal mastermind, grants her tieflings magic that is useful for committing heists.",
              ],
            },
          }),
        ],
      });

      const body = container.querySelector("details")!.textContent!;

      expect(body).toContain("criminal mastermind");
      // Ahead of the mechanics, which is the whole point of putting it here.
      expect(body.indexOf("criminal mastermind")).toBeLessThan(
        body.indexOf("Ability Scores"),
      );
    });

    /** 24 of the 69 subraces have no such record in the books. */
    it("opens on the numbers for a subrace the books describe nowhere", async () => {
      const { container } = await renderPage({
        subraces: [
          subrace("winged", "Winged", {
            ability: [{ cha: 2 }],
            fluff: null,
          }),
        ],
      });

      expect(container.querySelector("details")!.textContent).toContain(
        "Ability Scores",
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

    /**
     * The Elf case. PHB Elf has two subraces named Eladrin, one printed in the
     * DMG and one in Mordenkainen's, and both slug to `eladrin` — the only pair
     * in the data that collides. Keying either list on the slug drops one of
     * them, and neither the outline nor the disclosures would say so.
     *
     * The shared anchor is left alone deliberately: `hrefFor` builds a fragment
     * from the slug for every fragment type, so telling these two apart in a
     * URL is a change to the route map rather than to this page. Both rows are
     * rendered and the anchor lands on the first.
     */
    it("renders two subraces that share a slug", async () => {
      const warnings: unknown[][] = [];
      const spy = vi
        .spyOn(console, "error")
        .mockImplementation((...args) => void warnings.push(args));

      try {
        const { container } = await renderPage({
          name: "Elf",
          slug: "elf",
          subraces: [
            subrace("eladrin", "Eladrin", {
              sourceId: "DMG",
              sourceName: "Dungeon Master's Guide",
            }),
            subrace("eladrin", "Eladrin", {
              sourceId: "MTF",
              sourceName: "Mordenkainen's Tome of Foes",
            }),
          ],
        });

        expect(container.querySelectorAll("details")).toHaveLength(2);
        expect(
          outlineLinks(container).filter(
            (link) => link.textContent === "Eladrin",
          ),
        ).toHaveLength(2);
        expect(container.textContent).toContain("Dungeon Master's Guide");
        expect(container.textContent).toContain("Mordenkainen's Tome of Foes");

        // A duplicate key warns rather than throwing, and React still paints
        // both rows — so the warning is the only thing that catches a regression.
        expect(
          warnings.filter(([message]) => String(message).includes("same key")),
        ).toEqual([]);
      } finally {
        spy.mockRestore();
      }
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
