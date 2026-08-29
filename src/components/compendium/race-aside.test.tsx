import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { RaceDetail } from "@/server/db/queries/races";
import { RaceAside } from "./race-aside";

/**
 * A race at aside width.
 *
 * As with the class aside, the assertions that matter are the absences: the
 * named traits and the subraces belong to the full page, and a PHB Tiefling's
 * twelve subraces in a 400px column would be worse than not opening it.
 */

const race = (over: Partial<RaceDetail> = {}): RaceDetail =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    naturalKey: "race|dwarf|phb",
    name: "Dwarf",
    slug: "dwarf",
    sourceId: "PHB",
    sourceName: "Player's Handbook",
    page: 18,
    isNpcRace: false,
    size: ["M"],
    speed: 25,
    ability: [{ con: 2 }],
    fluff: null,
    data: {
      entries: [
        "Kingdoms rich in ancient grandeur.",
        { type: "entries", name: "Darkvision", entries: ["You see in the dark."] },
      ],
    },
    subraces: [
      { id: "s1", name: "Hill Dwarf" },
      { id: "s2", name: "Mountain Dwarf" },
    ],
    ...over,
  }) as unknown as RaceDetail;

describe("the race aside", () => {
  it("identifies the race and where it was printed", () => {
    render(<RaceAside race={race()} refs={{}} />);

    expect(screen.getByRole("heading", { name: "Dwarf" })).toBeInTheDocument();
    expect(screen.getByText(/Player's Handbook/)).toBeInTheDocument();
    expect(screen.getByText(/p\. 18/)).toBeInTheDocument();
  });

  it("carries the numbers that characterise a race", () => {
    render(<RaceAside race={race()} refs={{}} />);

    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("25 ft.")).toBeInTheDocument();
    expect(screen.getByText("+2 CON")).toBeInTheDocument();
  });

  /**
   * The description falls back to `data.entries` only when fluff has none.
   * That is the rarer case by a wide margin — 5 races of 134.
   */
  it("prints the opening description from data when there is no fluff", () => {
    render(<RaceAside race={race()} refs={{}} />);

    expect(
      screen.getByText(/Kingdoms rich in ancient grandeur/),
    ).toBeInTheDocument();
  });

  /**
   * Fluff wins, because that is where 98 of the 134 races keep their prose. An
   * MPMM race's `data.entries` are nothing but named traits, so reading those
   * alone would leave most races with nothing to say for themselves.
   */
  it("prefers the description in fluff", () => {
    render(
      <RaceAside
        race={race({
          fluff: { entries: ["A winged people of the Elemental Plane of Air."] },
        })}
        refs={{}}
      />,
    );

    expect(
      screen.getByText(/winged people of the Elemental Plane/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Kingdoms rich in ancient grandeur/),
    ).not.toBeInTheDocument();
  });

  /**
   * Named, not printed. Every race has traits and they are the mechanical
   * answer to "what does this do" — but each runs to paragraphs, so the aside
   * says what is on offer and the page says what it does.
   */
  it("names the traits without printing them", () => {
    render(<RaceAside race={race()} refs={{}} />);

    expect(screen.getByText("Darkvision")).toBeInTheDocument();
    expect(screen.queryByText(/You see in the dark/)).not.toBeInTheDocument();
  });

  /** Subraces belong to the full page; a Tiefling has twelve. */
  it("leaves the subraces to the full page", () => {
    render(<RaceAside race={race()} refs={{}} />);

    expect(screen.queryByText("Hill Dwarf")).not.toBeInTheDocument();
  });

  it("counts the subraces on the way out", () => {
    render(<RaceAside race={race()} refs={{}} />);

    const link = screen.getByRole("link", { name: /full page/i });

    expect(link).toHaveAttribute("href", "/compendium/races/phb/dwarf");
    expect(link).toHaveTextContent(/2 subraces/);
  });

  it("says nothing about subraces for a race with none", () => {
    render(<RaceAside race={race({ subraces: [] })} refs={{}} />);

    expect(
      screen.getByRole("link", { name: /full page/i }),
    ).not.toHaveTextContent(/subrace/);
  });

  it("counts a lone subrace in the singular", () => {
    render(
      <RaceAside race={race({ subraces: [{ id: "s1" }] as never })} refs={{}} />,
    );

    expect(
      screen.getByRole("link", { name: /full page/i }),
    ).toHaveTextContent(/1 subrace(?!s)/);
  });

  /**
   * Someone who meets an NPC race mid-chapter has the same question as someone
   * arriving at its page: why is this not in the index. The aside is where they
   * are, so the answer cannot wait for a click through.
   */
  it("flags an NPC race in place", () => {
    render(<RaceAside race={race({ isNpcRace: true })} refs={{}} />);

    expect(screen.getByText(/building NPCs/i)).toBeInTheDocument();
  });

  it("says nothing of the sort for a playable race", () => {
    render(<RaceAside race={race()} refs={{}} />);

    expect(screen.queryByText(/building NPCs/i)).not.toBeInTheDocument();
  });
});
