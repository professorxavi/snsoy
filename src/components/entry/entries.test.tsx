import { describe, expect, it } from "vitest";
import type { OptionalFeatureIndex } from "@/lib/content/optional-features";
import { render, screen } from "@/test/render";
import { resetCoverage, coverageReport } from "./coverage";
import { Entries } from "./entries";
import type { Entry } from "./types";

/**
 * Table markup, which is where a chapter's reference material lives.
 *
 * `tables.test.ts` proves a class name becomes the right share of the width;
 * what it cannot prove is that the share reaches the document. Widths only bind
 * to a column through a `<colgroup>`, so the failures this covers are the ones
 * that leave the page looking untouched: no column group emitted, one column
 * short of the row it describes, or the group written into a `<table>` that has
 * no hints to carry.
 */

const CLASSES: Entry = {
  type: "table",
  caption: "Classes",
  colLabels: ["Class", "Description", "Hit Die"],
  colStyles: ["col-1", "col-4", "col-1 text-center"],
  rows: [["Barbarian", "A fierce warrior", "d12"]],
};

const columns = () => [...document.querySelectorAll("col")];

describe("a table's declared column widths", () => {
  it("gives every column its printed share of the table", () => {
    render(<Entries entries={[CLASSES]} />);

    expect(columns().map((col) => col.style.width)).toEqual([
      "8.3333%",
      "33.3333%",
      "8.3333%",
    ]);
  });

  /**
   * A row wider than its hints is common enough to matter — a missing `<col>`
   * shifts every later width onto the wrong column.
   */
  it("covers the columns the rows actually have", () => {
    render(
      <Entries
        entries={[
          { type: "table", colStyles: ["col-2"], rows: [["a", "b", "c"]] },
        ]}
      />,
    );

    expect(columns()).toHaveLength(3);
  });

  it("writes no column group for a table that declares no widths", () => {
    render(
      <Entries entries={[{ type: "table", rows: [["a", "b"]] }]} />,
    );

    expect(columns()).toHaveLength(0);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

/**
 * A feature's options are stored as a reference to another entity, so the
 * renderer prints what a page loaded for it rather than what the entry carries.
 * The failure worth catching is the quiet one: an option whose body never
 * arrived, printing as nothing under a feature that just said "choose one".
 */
describe("an optional feature a class offers as a choice", () => {
  const CHOICE: Entry = {
    type: "options",
    count: 1,
    entries: [
      { type: "refOptionalfeature", optionalfeature: "Archery" },
      { type: "refOptionalfeature", optionalfeature: "Blind Fighting|TCE" },
    ],
  };

  const OPTIONS: OptionalFeatureIndex = {
    "optionalfeature|archery|phb": {
      name: "Archery",
      prerequisite: null,
      entries: ["You gain a +2 bonus to ranged attack rolls."],
      sourceId: "PHB",
      sourceName: "Player's Handbook",
    },
    "optionalfeature|blind fighting|tce": {
      name: "Blind Fighting",
      prerequisite: "5th level, Pact of the Tome",
      entries: ["You have blindsight."],
      sourceId: "TCE",
      sourceName: "Tasha's Cauldron of Everything",
    },
  };

  it("prints each option's name and text where it is offered", () => {
    render(<Entries entries={[CHOICE]} options={OPTIONS} />);

    expect(screen.getByText("Archery")).toBeInTheDocument();
    expect(
      screen.getByText("You gain a +2 bonus to ranged attack rolls."),
    ).toBeInTheDocument();
    expect(screen.getByText("You have blindsight.")).toBeInTheDocument();
  });

  it("prints what an option requires before it can be taken", () => {
    render(<Entries entries={[CHOICE]} options={OPTIONS} />);

    expect(
      screen.getByText("Prerequisite: 5th level, Pact of the Tome"),
    ).toBeInTheDocument();
  });

  /**
   * Keeping the name is the point: a page that dropped it would leave the
   * feature above reading as an instruction with nothing to follow.
   */
  it("still names an option whose body was never loaded, and reports it", () => {
    resetCoverage();
    render(<Entries entries={[CHOICE]} />);

    expect(screen.getByText("Archery")).toBeInTheDocument();
    expect(
      coverageReport().filter((gap) => gap.kind === "option"),
    ).toHaveLength(2);
  });

  it("has nothing to show for a choice with no options in it", () => {
    const { container } = render(
      <Entries entries={[{ type: "options", entries: [] }]} />,
    );

    expect(container.textContent).toBe("");
  });
});

/**
 * The two numbers a spellcasting feature ends on. Stored as a type rather than
 * as text because the ability differs by class, so a renderer that does not
 * know the type prints nothing where a character sheet needs a number.
 */
describe("a save DC or attack modifier a feature grants", () => {
  it("writes out the save DC formula with the class's own ability", () => {
    render(
      <Entries
        entries={[{ type: "abilityDc", name: "Spell", attributes: ["cha"] }]}
      />,
    );

    expect(
      screen.getByText(/= 8 \+ your proficiency bonus \+ your Charisma modifier/),
    ).toBeInTheDocument();
    expect(screen.getByText("Spell save DC")).toBeInTheDocument();
  });

  /** The attack modifier is the same formula without the 8. */
  it("writes out the attack modifier formula", () => {
    render(
      <Entries
        entries={[
          { type: "abilityAttackMod", name: "Spell", attributes: ["int"] },
        ]}
      />,
    );

    expect(screen.getByText("Spell attack modifier")).toBeInTheDocument();
    expect(screen.queryByText(/8 \+/)).toBeNull();
  });

  /** A Battle Master's maneuvers, which are not spells and key off either. */
  it("names what the formula is for, and a choice of abilities", () => {
    render(
      <Entries
        entries={[
          { type: "abilityDc", name: "Maneuver", attributes: ["str", "dex"] },
        ]}
      />,
    );

    expect(screen.getByText("Maneuver save DC")).toBeInTheDocument();
    expect(
      screen.getByText(/your Strength or Dexterity modifier/),
    ).toBeInTheDocument();
  });
});

/**
 * A feature the corpus builds another feature out of. Both are stored as
 * siblings, so printing the reference is what tells the reader that "Guardian"
 * is a model of Arcane Armor rather than a feature of its own.
 */
describe("a feature referenced by another feature", () => {
  const REFERENCE: Entry = {
    type: "refSubclassFeature",
    subclassFeature: "Guardian|Artificer|TCE|Armorer|TCE|15",
  };

  const FEATURES = {
    "subclassfeature|guardian|artificer|tce|armorer|tce|15|tce": {
      name: "Guardian",
      entries: ["Your armor bristles with spikes."],
    },
  };

  it("prints the referenced feature where it is referenced", () => {
    render(<Entries entries={[REFERENCE]} features={FEATURES} />);

    expect(screen.getByText("Guardian")).toBeInTheDocument();
    expect(
      screen.getByText("Your armor bristles with spikes."),
    ).toBeInTheDocument();
  });

  /**
   * Rendered as nothing rather than as a stub: the page drops a referenced
   * feature from its flat list, so a stub here would be the only trace of a
   * feature whose text went missing — and it is reported instead.
   */
  it("reports a reference whose feature was never loaded", () => {
    resetCoverage();
    const { container } = render(<Entries entries={[REFERENCE]} />);

    expect(container.textContent).toBe("");
    expect(coverageReport().filter((gap) => gap.kind === "feature")).toHaveLength(
      1,
    );
  });
});
