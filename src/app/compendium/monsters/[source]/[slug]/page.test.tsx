import { beforeEach, describe, expect, it, vi } from "vitest";
import { AsideProvider } from "@/components/compendium/aside-context";
import { render, screen } from "@/test/render";
import type { MonsterDetail } from "@/server/db/queries/monsters";
import MonsterPage, { generateMetadata } from "./page";

/**
 * What a creature page puts on screen, given a creature.
 *
 * The stat block has its own tests and so do the formatters behind it. What is
 * this page's own is the document it assembles around them: one heading rather
 * than the block's as well, the numbers before the prose, the lore split into
 * outlined sections, and a token standing in for the 1,125 creatures with no
 * illustration.
 *
 * `notFound()` throws by design, which is how the 404 case is asserted.
 */

vi.mock("@/server/db/queries/monsters", () => ({ getMonster: vi.fn() }));
vi.mock("@/server/db/queries/references", () => ({
  resolveReferences: vi.fn(),
}));

const { getMonster } = await import("@/server/db/queries/monsters");
const { resolveReferences } = await import("@/server/db/queries/references");

/** A goblin with the parts this page reads: a block, lore and artwork. */
const goblin = (over: Partial<MonsterDetail> = {}): MonsterDetail =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    naturalKey: "monster|goblin|mm",
    name: "Goblin",
    slug: "goblin",
    sourceId: "MM",
    page: 166,
    sourceName: "Monster Manual",
    crDisplay: "1/4",
    isLegendary: false,
    data: {
      size: ["S"],
      type: "humanoid",
      alignment: ["N", "E"],
      ac: [{ ac: 15, from: ["leather armor", "shield"] }],
      hp: { average: 7, formula: "2d6" },
      speed: { walk: 30 },
      str: 8,
      dex: 14,
      con: 10,
      int: 10,
      wis: 8,
      cha: 8,
      passive: 9,
      cr: "1/4",
      environment: ["forest", "underdark", "hill"],
      action: [
        { name: "Scimitar", entries: ["Melee weapon attack, 5 ft."] },
      ],
    },
    fluff: {
      entries: [
        "Goblins are small, black-hearted humanoids.",
        {
          type: "entries",
          name: "Goblin Warrens",
          entries: ["They lair in caves and abandoned mines."],
        },
      ],
      images: [
        {
          type: "image",
          href: { type: "internal", path: "bestiary/MM/Goblin.webp" },
          width: 400,
          height: 600,
          credit: "Wizards of the Coast",
        },
      ],
    },
    ...over,
  }) as unknown as MonsterDetail;

const renderPage = async (over: Partial<MonsterDetail> = {}) => {
  vi.mocked(getMonster).mockResolvedValue(goblin(over));
  return render(
    <AsideProvider>
      {await MonsterPage({
        params: Promise.resolve({ source: "mm", slug: "goblin" }),
      })}
    </AsideProvider>,
  );
};

/**
 * The outline is a wide-viewport element and jsdom never evaluates the media
 * query that reveals it, so it has to be asked for hidden and matched on its
 * label rather than its accessible name.
 */
const outline = () =>
  screen
    .queryAllByRole("navigation", { hidden: true })
    .find((nav) => nav.getAttribute("aria-label") === "On this page");

beforeEach(() => {
  // Call counts are asserted below, so they are cleared rather than carried.
  vi.clearAllMocks();
  vi.mocked(resolveReferences).mockResolvedValue({});
});

describe("the creature page", () => {
  /**
   * The bug this guards. The stat block prints the name too, and letting it do
   * so on the page as well would put two `h1`s on one document.
   */
  it("prints exactly one heading for the creature", async () => {
    await renderPage();

    const headings = screen.getAllByRole("heading", { name: "Goblin" });
    expect(headings).toHaveLength(1);
    expect(headings[0]!.tagName).toBe("H1");
  });

  it("credits the book it came from", async () => {
    await renderPage();

    expect(
      screen.getByRole("link", { name: "Monster Manual" }),
    ).toHaveAttribute("href", "/sources/mm");
    expect(screen.getByText(/p\. 166/)).toBeInTheDocument();
  });

  /** The numbers are what a creature is opened for, so they are on the page. */
  it("prints the stat block", async () => {
    await renderPage();

    expect(screen.getByText("Small humanoid, neutral evil")).toBeInTheDocument();
    expect(screen.getByText("Armor Class")).toBeInTheDocument();
    expect(screen.getByText("Hit Points")).toBeInTheDocument();
    expect(screen.getByText("Speed")).toBeInTheDocument();
    expect(screen.getByText("Scimitar.")).toBeInTheDocument();
  });

  /** The lore, which renders nowhere else in the app. */
  it("prints the lore under the block", async () => {
    await renderPage();

    expect(screen.getByText(/black-hearted humanoids/)).toBeInTheDocument();
    expect(screen.getByText(/abandoned mines/)).toBeInTheDocument();
  });

  it("outlines the named lore sections", async () => {
    await renderPage();

    expect(outline()).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Goblin Warrens", hidden: true }),
    ).toBeInTheDocument();
  });

  /**
   * Roughly 1,988 of the 2,517 creatures with lore have prose only. An outline
   * pointing at one thing is worse than the full-width column.
   */
  it("drops the outline when the lore has no named section", async () => {
    await renderPage({
      fluff: { entries: ["Just prose, no sections."] },
    } as Partial<MonsterDetail>);

    expect(outline()).toBeUndefined();
  });

  it("names where the creature is found", async () => {
    await renderPage();

    expect(screen.getByText("Environment")).toBeInTheDocument();
    expect(screen.getByText("Forest, Hill, Underdark")).toBeInTheDocument();
  });

  it("credits the artist", async () => {
    await renderPage();

    expect(screen.getByText("Art credits")).toBeInTheDocument();
    expect(screen.getByText("Wizards of the Coast")).toBeInTheDocument();
  });

  /**
   * The rule this page renders no matter what. A creature is cited from
   * thousands of places, and a wall of links naming them answers a question
   * about the books rather than about the creature.
   */
  it("never says what refers to it", async () => {
    await renderPage();

    expect(screen.queryByText(/referenced by/i)).toBeNull();
  });

  /** One round trip for the block and the lore together, not one each. */
  it("resolves the block's references and the lore's in one pass", async () => {
    await renderPage();

    expect(resolveReferences).toHaveBeenCalledTimes(1);
  });

  it("404s for a creature that does not exist", async () => {
    vi.mocked(getMonster).mockResolvedValue(null);

    await expect(
      MonsterPage({ params: Promise.resolve({ source: "mm", slug: "nope" }) }),
    ).rejects.toThrow();
  });
});

/**
 * The fallback for the 1,125 creatures with no illustration — every one of
 * which has a map token, derived by convention from its name and source.
 */
describe("a creature with no artwork", () => {
  const srcs = () =>
    screen
      .queryAllByRole("img", { hidden: true })
      .map((img) => decodeURIComponent(img.getAttribute("src") ?? ""));

  it("stands in its token", async () => {
    await renderPage({ fluff: { entries: ["Prose."] } } as Partial<MonsterDetail>);

    expect(srcs().some((src) => src.includes("bestiary/tokens/MM/Goblin.webp"))).toBe(
      true,
    );
  });

  it("shows no token when the creature has art", async () => {
    await renderPage();

    expect(srcs().some((src) => src.includes("bestiary/tokens"))).toBe(false);
    expect(srcs().some((src) => src.includes("bestiary/MM/Goblin.webp"))).toBe(true);
  });
});

describe("its metadata", () => {
  it("names the creature, what it is and its rating", async () => {
    vi.mocked(getMonster).mockResolvedValue(goblin());

    const meta = await generateMetadata({
      params: Promise.resolve({ source: "mm", slug: "goblin" }),
    });

    expect(meta.title).toBe("Goblin · Creatures");
    expect(meta.description).toMatch(/Small humanoid, neutral evil/);
    expect(meta.description).toMatch(/Challenge 1\/4/);
    expect(meta.description).toMatch(/Monster Manual, p\. 166/);
  });

  it("says so when there is no such creature", async () => {
    vi.mocked(getMonster).mockResolvedValue(null);

    const meta = await generateMetadata({
      params: Promise.resolve({ source: "mm", slug: "nope" }),
    });

    expect(meta.title).toBe("Not found");
  });
});
