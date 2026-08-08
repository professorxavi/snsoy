import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import type { RaceListGroup } from "@/server/db/queries/races";
import RacesPage from "./page";

/**
 * What the races index puts on screen, given groups.
 *
 * A race is a short document rather than a row of comparable values, so this
 * page is a grouped list that navigates to a reading page — not a filterable
 * table with an aside like spells. The absence of a rail is the design, and
 * asserting it here is what stops one arriving by habit.
 */

vi.mock("@/server/db/queries/races", () => ({ listRacesBySource: vi.fn() }));
const { listRacesBySource } = await import("@/server/db/queries/races");

const GROUPS = [
  {
    sourceId: "PHB",
    sourceName: "Player's Handbook",
    races: [
      {
        id: "1",
        name: "Dwarf",
        slug: "dwarf",
        sourceId: "PHB",
        size: ["M"],
        speed: 25,
        ability: [{ con: 2 }],
      },
      {
        id: "2",
        name: "Elf",
        slug: "elf",
        sourceId: "PHB",
        size: ["M"],
        speed: 30,
        ability: [{ dex: 2 }],
      },
    ],
  },
  {
    sourceId: "MPMM",
    sourceName: "Monsters of the Multiverse",
    races: [
      {
        id: "3",
        name: "Aasimar",
        slug: "aasimar",
        sourceId: "MPMM",
        size: ["M"],
        speed: 30,
        ability: null,
      },
    ],
  },
] as unknown as RaceListGroup[];

const renderPage = async () => render(await RacesPage());

const raceLinks = () =>
  screen
    .getAllByRole("link")
    .filter((link) =>
      /^\/compendium\/races\/[^/]+\/[^/]+$/.test(link.getAttribute("href")!),
    );

beforeEach(() => {
  vi.mocked(listRacesBySource).mockResolvedValue(GROUPS);
});

describe("the races index", () => {
  it("heads each group with the book that printed it", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Player's Handbook", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Monsters of the Multiverse",
        level: 2,
      }),
    ).toBeInTheDocument();
  });

  it("links every race to its own page", async () => {
    await renderPage();

    expect(raceLinks().map((link) => link.getAttribute("href"))).toEqual([
      "/compendium/races/phb/dwarf",
      "/compendium/races/phb/elf",
      "/compendium/races/mpmm/aasimar",
    ]);
  });

  it("keeps the groups in the order the query returned them", async () => {
    await renderPage();

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);

    expect(headings).toEqual([
      "Player's Handbook",
      "Monsters of the Multiverse",
    ]);
  });

  it("summarises each race on its row", async () => {
    await renderPage();

    const dwarf = raceLinks()[0]!;

    expect(within(dwarf).getByText("Dwarf")).toBeInTheDocument();
    expect(dwarf.textContent).toContain("Medium");
    expect(dwarf.textContent).toContain("25 ft");
  });

  /** A race with nothing recorded should still be a row, not a blank line. */
  it("copes with a race that has no ability bonuses", async () => {
    await renderPage();

    const aasimar = raceLinks()[2]!;

    expect(within(aasimar).getByText("Aasimar")).toBeInTheDocument();
    expect(aasimar.textContent).not.toContain("—");
  });

  /**
   * No rail, and no aside. Races navigate to a reading page; a spell-style
   * browse frame here would promise filtering that does not exist.
   */
  it("has no filter rail", async () => {
    const { container } = await renderPage();

    expect(container.querySelector('[data-col-optional]')).toBeNull();
    expect(
      screen.queryByRole("searchbox", { name: /Search/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Pagination" }),
    ).not.toBeInTheDocument();
  });
});
