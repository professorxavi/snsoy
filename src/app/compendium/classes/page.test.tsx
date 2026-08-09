import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import type { ClassListGroup } from "@/server/db/queries/classes";
import ClassesPage from "./page";

/**
 * What the classes index puts on screen.
 *
 * Thirteen rows over two books, so there is no rail and no table — the whole
 * page is the choice between them, and the line under each name is what that
 * choice is made on.
 */

vi.mock("@/server/db/queries/classes", () => ({ listClassesBySource: vi.fn() }));
const { listClassesBySource } = await import("@/server/db/queries/classes");

const GROUPS = [
  {
    sourceId: "PHB",
    sourceName: "Player's Handbook",
    classes: [
      {
        id: "1",
        name: "Fighter",
        slug: "fighter",
        sourceId: "PHB",
        sourceName: "Player's Handbook",
        page: 70,
        hitDie: 10,
        casterProgression: null,
        spellcastingAbility: null,
        savingThrows: ["str", "con"],
        subclassTitle: "Martial Archetype",
        subclassCount: 10,
      },
      {
        id: "2",
        name: "Wizard",
        slug: "wizard",
        sourceId: "PHB",
        sourceName: "Player's Handbook",
        page: 112,
        hitDie: 6,
        casterProgression: "full",
        spellcastingAbility: "int",
        savingThrows: ["int", "wis"],
        subclassTitle: "Arcane Tradition",
        subclassCount: 14,
      },
    ],
  },
  {
    sourceId: "TCE",
    sourceName: "Tasha's Cauldron of Everything",
    classes: [
      {
        id: "3",
        name: "Artificer",
        slug: "artificer",
        sourceId: "TCE",
        sourceName: "Tasha's Cauldron of Everything",
        page: 9,
        hitDie: 8,
        casterProgression: "artificer",
        spellcastingAbility: "int",
        savingThrows: ["con", "int"],
        subclassTitle: "Artificer Specialist",
        subclassCount: 4,
      },
    ],
  },
] as unknown as ClassListGroup[];

const renderPage = async () => render(await ClassesPage());

beforeEach(() => {
  vi.mocked(listClassesBySource).mockResolvedValue(GROUPS);
});

describe("the classes index", () => {
  it("lists every class under the book that printed it", async () => {
    await renderPage();

    const sections = screen.getAllByRole("heading", { level: 2 });
    expect(sections.map((heading) => heading.textContent)).toEqual([
      "Player's Handbook",
      "Tasha's Cauldron of Everything",
    ]);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("links each class to its own page under its source", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: /Artificer/ })).toHaveAttribute(
      "href",
      "/compendium/classes/tce/artificer",
    );
  });

  /** The line people actually choose on: what it survives, and whether it casts. */
  it("summarises a class by hit die, saves, casting and subclass count", async () => {
    await renderPage();

    const wizard = screen.getByRole("link", { name: /Wizard/ });
    expect(wizard).toHaveTextContent(
      "d6 · Intelligence & Wisdom · Full caster · 14 arcane traditions",
    );
  });

  /** A non-caster says nothing about casting rather than saying "none". */
  it("leaves casting off a class that does not cast", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: /Fighter/ })).toHaveTextContent(
      "d10 · Strength & Constitution · 10 martial archetypes",
    );
  });

  it("has no filter rail", async () => {
    const { container } = await renderPage();

    expect(
      within(container).queryByRole("navigation", { name: "Filters" }),
    ).toBeNull();
  });
});
