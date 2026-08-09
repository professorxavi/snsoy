import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import type { ClassDetail } from "@/server/db/queries/classes";
import ClassPage, { generateMetadata } from "./page";

/**
 * The class page. The table has its own tests and so do the helpers behind it,
 * so what is left here is the page's own assembly: which sections appear, what
 * the outline points at, and whether a subclass printed in a later book is
 * still reachable from the class that owns it.
 */

vi.mock("@/server/db/queries/classes", () => ({ getClass: vi.fn() }));
vi.mock("@/server/db/queries/references", () => ({
  resolveReferences: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/server/db/queries/optional-features", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/db/queries/optional-features")
  >("@/server/db/queries/optional-features");
  return {
    ...actual,
    listOptionalFeaturesByKey: vi.fn().mockResolvedValue([]),
    listOptionalFeaturesByType: vi.fn().mockResolvedValue([]),
  };
});
const { getClass } = await import("@/server/db/queries/classes");
const { listOptionalFeaturesByKey, listOptionalFeaturesByType } = await import(
  "@/server/db/queries/optional-features"
);

/** An optional feature as the query returns it. */
const option = (name: string, source: string, types: string[]) => ({
  naturalKey: `optionalfeature|${name.toLowerCase()}|${source.toLowerCase()}`,
  name,
  sourceId: source,
  sourceName: source,
  page: 1,
  featureTypes: types,
  prerequisites: null,
  data: { entries: [`${name} does something.`] },
});

const feature = (name: string, level: number, over = {}) => ({
  id: `${name}-${level}`,
  naturalKey: `classFeature|${name.toLowerCase()}|phb`,
  name,
  slug: name.toLowerCase().replace(/\W+/g, "-"),
  sourceId: "PHB",
  sourceName: "Player's Handbook",
  page: 72,
  level,
  subclassId: null,
  isAbilityScoreImprovement: false,
  data: { entries: [`${name} does something.`] },
  ...over,
});

const fighter = (over: Partial<ClassDetail> = {}): ClassDetail =>
  ({
    id: "fighter-id",
    naturalKey: "class|fighter|phb",
    name: "Fighter",
    slug: "fighter",
    sourceId: "PHB",
    sourceName: "Player's Handbook",
    page: 70,
    fluff: {
      entries: [
        { type: "section", name: "Fighter", entries: ["A master of combat."] },
      ],
    },
    hitDie: 10,
    casterProgression: null,
    spellcastingAbility: null,
    preparesSpells: false,
    savingThrows: ["str", "con"],
    subclassTitle: "Martial Archetype",
    data: {
      classFeatures: ["Second Wind|Fighter||1", "Fighting Style|Fighter||1"],
      startingProficiencies: { weapons: ["simple", "martial"] },
      startingEquipment: { default: ["(a) chain mail or (b) leather armor"] },
    },
    features: [feature("Fighting Style", 1), feature("Second Wind", 1)],
    subclasses: [
      {
        id: "champion-id",
        naturalKey: "subclass|champion|phb",
        name: "Champion",
        slug: "champion",
        sourceId: "PHB",
        sourceName: "Player's Handbook",
        page: 72,
        shortName: "Champion",
        casterProgression: null,
        spellcastingAbility: null,
        data: {},
        features: [feature("Improved Critical", 3, { subclassId: "champion-id" })],
      },
    ],
    ...over,
  }) as unknown as ClassDetail;

/** The id the page anchors its subclass section on. */
const SUBCLASSES_ID = "subclasses";

const renderPage = async (source = "phb", slug = "fighter") =>
  render(await ClassPage({ params: Promise.resolve({ source, slug }) }));

/**
 * The outline is a wide-viewport element and jsdom never evaluates the media
 * query that reveals it, so it has to be asked for hidden and matched on its
 * label rather than its accessible name.
 */
const outline = () =>
  screen
    .queryAllByRole("navigation", { hidden: true })
    .find((nav) => nav.getAttribute("aria-label") === "On this page")!;

beforeEach(() => {
  vi.mocked(getClass).mockResolvedValue(fighter());
  vi.mocked(listOptionalFeaturesByKey).mockResolvedValue([]);
  vi.mocked(listOptionalFeaturesByType).mockResolvedValue([]);
});

describe("a class page", () => {
  it("titles itself with the class and places it in its book", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Fighter" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Player's Handbook" }),
    ).toHaveAttribute("href", "/sources/phb");
    expect(screen.getByText("d10")).toBeInTheDocument();
    expect(screen.getByText("Strength & Constitution")).toBeInTheDocument();
  });

  /** A class's own name is not a heading on a page already titled with it. */
  it("does not repeat the class name as a heading of its description", async () => {
    await renderPage();

    expect(screen.getByText("A master of combat.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Fighter" })).toBeNull();
  });

  describe("the class table", () => {
    it("orders the features of a level the way the class prints them", async () => {
      await renderPage();

      const firstLevel = within(screen.getByRole("table")).getAllByRole("row")[1]!;
      expect(firstLevel).toHaveTextContent("Second Wind, Fighting Style");
    });
  });

  it("prints what the class starts with", async () => {
    await renderPage();

    expect(screen.getByText("Simple weapons, martial weapons")).toBeInTheDocument();
    expect(
      screen.getByText("(a) chain mail or (b) leather armor"),
    ).toBeInTheDocument();
  });

  it("gives every feature its own heading, with the level it arrives at", async () => {
    await renderPage();

    const heading = screen.getByRole("heading", { level: 3, name: /Second Wind/ });
    expect(heading).toHaveTextContent("1st level");
    expect(screen.getByText("Second Wind does something.")).toBeInTheDocument();
  });

  describe("subclasses", () => {
    /**
     * Subclasses have a route reserved and no view behind it, so they open in
     * place here. A link would 404.
     */
    it("opens a subclass on this page rather than linking away", async () => {
      const { container } = await renderPage();
      const section = within(
        container.ownerDocument.getElementById(SUBCLASSES_ID)!,
      );

      expect(section.getByText("Champion")).toBeInTheDocument();
      expect(
        section.getByText("Improved Critical does something."),
      ).toBeInTheDocument();
      expect(section.queryByRole("link", { name: "Champion" })).toBeNull();
    });

    it("anchors each one, and lists it in the outline under the class's own name", async () => {
      const { container } = await renderPage();

      const labels = within(outline())
        .getAllByRole("link", { hidden: true })
        .map((link) => link.textContent);

      expect(labels).toContain("Martial Archetype");
      expect(labels).toContain("Champion");
      expect(container.ownerDocument.getElementById("champion")).not.toBeNull();
    });

    it("says nothing about subclasses for a class with none", async () => {
      vi.mocked(getClass).mockResolvedValue(fighter({ subclasses: [] }));
      const { container } = await renderPage();

      expect(container.ownerDocument.getElementById(SUBCLASSES_ID)).toBeNull();
      expect(screen.queryByText("Champion")).toBeNull();
    });
  });

  /**
   * The options a class chooses between arrive two ways, and the page has to
   * take each of them exactly once. A feature that names its options prints
   * them where it offers them; a class whose features name none — a Warlock's
   * invocations — gets a list of its own. Doing both for the same options is
   * the same list twice on one page.
   */
  describe("the options a class chooses between", () => {
    const style = (name: string) => option(name, "PHB", ["FS:F"]);

    const withStyleChoice = () =>
      fighter({
        data: {
          ...(fighter().data as object),
          optionalfeatureProgression: [
            { name: "Fighting Style", featureType: ["FS:F"], progression: { "1": 1 } },
          ],
        },
        features: [
          {
            ...feature("Fighting Style", 1),
            data: {
              entries: [
                "Choose one of the following options.",
                {
                  type: "options",
                  entries: [
                    { type: "refOptionalfeature", optionalfeature: "Archery" },
                  ],
                },
              ],
            },
          },
        ],
      } as Partial<ClassDetail>);

    it("prints an option in full where the feature offers it", async () => {
      vi.mocked(getClass).mockResolvedValue(withStyleChoice());
      vi.mocked(listOptionalFeaturesByKey).mockResolvedValue([style("Archery")]);
      vi.mocked(listOptionalFeaturesByType).mockResolvedValue([style("Archery")]);
      const { container } = await renderPage();

      const features = within(
        container.ownerDocument.getElementById("class-features")!,
      );
      expect(features.getByText("Archery does something.")).toBeInTheDocument();
    });

    /** Named inline already, so a list of its own would repeat it. */
    it("adds no list for options a feature has already named", async () => {
      vi.mocked(getClass).mockResolvedValue(withStyleChoice());
      vi.mocked(listOptionalFeaturesByKey).mockResolvedValue([style("Archery")]);
      vi.mocked(listOptionalFeaturesByType).mockResolvedValue([style("Archery")]);
      await renderPage();

      expect(screen.getAllByText("Archery does something.")).toHaveLength(1);
      expect(
        screen.queryByRole("heading", { level: 2, name: "Fighting Style" }),
      ).toBeNull();
    });

    it("lists the options no feature names, and says how many you get", async () => {
      vi.mocked(getClass).mockResolvedValue(withStyleChoice());
      vi.mocked(listOptionalFeaturesByKey).mockResolvedValue([style("Archery")]);
      vi.mocked(listOptionalFeaturesByType).mockResolvedValue([
        style("Archery"),
        style("Defense"),
      ]);
      await renderPage();

      expect(
        screen.getByRole("heading", { level: 2, name: "Fighting Style" }),
      ).toBeInTheDocument();
      expect(screen.getByText("One at 1st level.")).toBeInTheDocument();
      // The one already named inline is not repeated under the heading.
      expect(screen.getByText("Defense does something.")).toBeInTheDocument();
      expect(screen.getAllByText("Archery does something.")).toHaveLength(1);
    });
  });

  it("404s on a class that does not exist", async () => {
    vi.mocked(getClass).mockResolvedValue(null);

    await expect(renderPage("phb", "no-such-class")).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });

  describe("metadata", () => {
    it("summarises the class in its description", async () => {
      const meta = await generateMetadata({
        params: Promise.resolve({ source: "phb", slug: "fighter" }),
      });

      expect(meta.title).toBe("Fighter · Classes");
      expect(meta.description).toContain("d10 hit die");
      expect(meta.description).toContain("Player's Handbook, p. 70");
    });

    it("says so when the class is missing rather than throwing", async () => {
      vi.mocked(getClass).mockResolvedValue(null);

      const meta = await generateMetadata({
        params: Promise.resolve({ source: "phb", slug: "nope" }),
      });

      expect(meta.title).toBe("Not found");
    });
  });
});
