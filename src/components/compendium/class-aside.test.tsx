import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { ClassDetail } from "@/server/db/queries/classes";
import { ClassAside } from "./class-aside";

/**
 * A class at aside width.
 *
 * The point of this component is what it leaves out. A class page is a
 * 20-level table, every feature across those levels and up to 130 subclasses,
 * and none of that belongs in a 400px column — so the assertions that matter
 * are the absences.
 */

const found = (over: Partial<ClassDetail> = {}): ClassDetail =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    naturalKey: "class|barbarian|phb",
    name: "Barbarian",
    slug: "barbarian",
    sourceId: "PHB",
    sourceName: "Player's Handbook",
    page: 46,
    hitDie: 12,
    casterProgression: null,
    spellcastingAbility: null,
    preparesSpells: false,
    savingThrows: ["str", "con"],
    subclassTitle: "Primal Path",
    fluff: {
      entries: [
        {
          type: "section",
          name: "Barbarian",
          source: "PHB",
          entries: ["A tall human tribesman strides through a blizzard."],
        },
      ],
    },
    data: {
      classTableGroups: [{ colLabels: ["Rages"], rows: [["2"]] }],
    },
    features: [{ name: "Rage", level: 1 }],
    subclasses: [
      { id: "s1", name: "Path of the Berserker", features: [] },
      { id: "s2", name: "Path of the Totem Warrior", features: [] },
    ],
    ...over,
  }) as unknown as ClassDetail;

describe("the class aside", () => {
  it("identifies the class and where it was printed", () => {
    render(<ClassAside found={found()} refs={{}} />);

    expect(
      screen.getByRole("heading", { name: "Barbarian" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Player's Handbook/)).toBeInTheDocument();
    expect(screen.getByText(/p\. 46/)).toBeInTheDocument();
  });

  it("carries the numbers that characterise a class", () => {
    render(<ClassAside found={found()} refs={{}} />);

    expect(screen.getByText("d12")).toBeInTheDocument();
    expect(screen.getByText("Strength & Constitution")).toBeInTheDocument();
    expect(screen.getByText("2 Primal Paths")).toBeInTheDocument();
  });

  it("prints the book's own opening description", () => {
    render(<ClassAside found={found()} refs={{}} />);

    expect(
      screen.getByText(/tall human tribesman strides through a blizzard/),
    ).toBeInTheDocument();
  });

  /**
   * The absences. Everything here is on the full page, and putting any of it in
   * a 400px column is what this component exists to avoid.
   */
  it("leaves the table, the features and the subclasses to the full page", () => {
    render(<ClassAside found={found()} refs={{}} />);

    expect(document.querySelector("table")).toBeNull();
    expect(screen.queryByText("Rage")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Path of the Berserker"),
    ).not.toBeInTheDocument();
  });

  /** The way to all of it, named the way the class names its subclasses. */
  it("offers the full page, pluralising the subclass title", () => {
    render(<ClassAside found={found()} refs={{}} />);

    const link = screen.getByRole("link", { name: /full page/i });

    expect(link).toHaveAttribute("href", "/compendium/classes/phb/barbarian");
    expect(link).toHaveTextContent(/primal paths/i);
  });

  it("falls back to 'subclasses' for a class that does not name them", () => {
    render(<ClassAside found={found({ subclassTitle: null })} refs={{}} />);

    expect(
      screen.getByRole("link", { name: /full page/i }),
    ).toHaveTextContent(/subclasses/i);
  });
});
