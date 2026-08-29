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

  /**
   * What the creature does on its own ground.
   *
   * Stored on a legendary group rather than on the creature, because a lair is
   * shared — every black dragon reads the same one — and the app showed none of
   * it until now. `monsters.smoke.test.ts` owns where it comes from; these own
   * where it lands, which is above the lore rule, because a lair action is
   * something a DM reads mid-encounter and not narrative.
   */
  describe("its lair", () => {
    const withLair = (lair: unknown) =>
      renderPage({ lair } as Partial<MonsterDetail>);

    const LAIR = {
      name: "Aboleth",
      lairActions: ["On initiative count 20, the aboleth takes a lair action."],
      regionalEffects: ["Water within 1 mile is fouled."],
    };

    it("prints the lair actions and the regional effects", async () => {
      await withLair(LAIR);

      expect(
        screen.getByRole("heading", { name: "Lair Actions", level: 2 }),
      ).toBeInTheDocument();
      expect(screen.getByText(/takes a lair action/)).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Regional Effects", level: 2 }),
      ).toBeInTheDocument();
      expect(screen.getByText(/Water within 1 mile/)).toBeInTheDocument();
    });

    /** Mechanics, so above the rule that says the mechanics have ended. */
    it("puts them above the lore", async () => {
      const { container } = await withLair(LAIR);

      const heading = screen.getByRole("heading", { name: "Lair Actions" });
      const lore = container.querySelector("#monster-lore-heading")!;
      expect(
        heading.compareDocumentPosition(lore) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    /** 24 groups carry lair actions and no regional effects, 23 the reverse. */
    it("prints only the half a group carries", async () => {
      await withLair({ name: "Kraken", lairActions: ["It calls a storm."] });

      expect(screen.getByRole("heading", { name: "Lair Actions" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Regional Effects" })).toBeNull();
    });

    /** Three groups carry one, and it is rendered rather than dropped. */
    it("prints a mythic encounter where there is one", async () => {
      await withLair({ name: "Arasta", mythicEncounter: ["To make it mythic…"] });

      expect(
        screen.getByRole("heading", { name: "Mythic Encounter", level: 2 }),
      ).toBeInTheDocument();
    });

    it("prints nothing for a creature with no group", async () => {
      await withLair(null);

      for (const name of ["Lair Actions", "Regional Effects", "Mythic Encounter"]) {
        expect(screen.queryByRole("heading", { name })).toBeNull();
      }
    });

    /**
     * Six of the 144 groups carry neither list — five hags whose upstream
     * `_copy` inheritance ingest never applied. A resolved group is not a
     * promise of content, so an empty one must draw no heading.
     */
    it("draws no heading for a group with nothing in it", async () => {
      await withLair({ name: "Night Hag" });

      expect(screen.queryByRole("heading", { name: "Lair Actions" })).toBeNull();
      expect(screen.queryByRole("heading", { name: "Regional Effects" })).toBeNull();
    });

    /**
     * The lair joins the page's single reference pass rather than getting one
     * of its own — an aboleth's lair action casts `phantasmal force`, and until
     * the lair was added to the collection that tag resolved against nothing.
     */
    it("collects the lair's references in the page's one pass", async () => {
      await withLair({
        name: "Aboleth",
        lairActions: ["The aboleth casts {@spell phantasmal force}."],
      });

      expect(resolveReferences).toHaveBeenCalledTimes(1);
      const asked = vi.mocked(resolveReferences).mock.calls[0]![0];
      expect([...asked]).toContain("spell|phantasmal force|phb");
    });
  });

  /**
   * Where the numbers stop.
   *
   * The stat block and the lore share a face, a size and a measure, so before
   * this opener the only thing between them was a gap — and on a phone the last
   * action and the first line of lore read as two paragraphs of one thing. The
   * label is the part that has to be there whatever the theme or the colour
   * settings do, so it is what these assert.
   */
  describe("the boundary between the block and the lore", () => {
    const opener = () => screen.queryByRole("heading", { name: "Lore", level: 2 });

    it("opens the lore with a heading of its own", async () => {
      await renderPage();

      expect(opener()).toBeInTheDocument();
    });

    /** The wrapper is named by that heading, so the section announces itself. */
    it("names the whole of the lore after it", async () => {
      const { container } = await renderPage();

      const section = container.querySelector(
        "section[aria-labelledby='monster-lore-heading']",
      );
      expect(section).not.toBeNull();
      expect(opener()).toHaveAttribute("id", "monster-lore-heading");
      expect(section).toContainElement(opener());
      expect(section!.textContent).toContain("black-hearted humanoids");
      expect(section!.textContent).toContain("abandoned mines");
    });

    /**
     * A step down, and only that. The outline and every inbound anchor point at
     * the id, which is why the id is asserted beside the level.
     */
    it("steps the named sections down beneath it", async () => {
      await renderPage();

      const heading = screen.getByRole("heading", { name: "Goblin Warrens" });
      expect(heading.tagName).toBe("H3");
      expect(document.getElementById("goblin-warrens")).not.toBeNull();
    });

    it("opens prose-only lore just the same", async () => {
      await renderPage({
        fluff: { entries: ["Just prose, no sections."] },
      } as Partial<MonsterDetail>);

      expect(opener()).toBeInTheDocument();
      expect(screen.getByText("Just prose, no sections.")).toBeInTheDocument();
    });

    /** And lore that is all sections, which leaves no prose above them. */
    it("opens section-only lore without an empty gap above it", async () => {
      await renderPage({
        fluff: {
          entries: [
            {
              type: "entries",
              name: "Goblin Warrens",
              entries: ["They lair in caves."],
            },
          ],
        },
      } as Partial<MonsterDetail>);

      expect(opener()).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Goblin Warrens" }).tagName).toBe("H3");
    });

    /** Nothing to divide, so nothing is drawn. */
    it("draws no boundary for a creature with no lore", async () => {
      const { container } = await renderPage({ fluff: undefined } as Partial<MonsterDetail>);

      expect(opener()).toBeNull();
      expect(
        container.querySelector("section[aria-labelledby='monster-lore-heading']"),
      ).toBeNull();
    });
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
