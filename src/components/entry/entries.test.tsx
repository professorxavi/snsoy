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

/**
 * A sentence the data broke apart and expects put back together.
 *
 * Found by the generic-entity smoke test, which is the only tier that would
 * have: two occurrences in one variant rule out of 12,364 entities. Both wrap a
 * link to a page of the reference site these data files were written for — a
 * site this app is not, and has no equivalent page on.
 */
describe("an inline run", () => {
  const RUN: Entry = {
    type: "inline",
    entries: [
      "Alternatively, see the ",
      {
        type: "link",
        text: "Point Buy Calculator.",
        href: { type: "internal", path: "statgen.html", hash: "pointbuy" },
      },
    ],
  };

  /** One paragraph, or the sentence breaks mid-clause. */
  it("closes the sentence back up rather than splitting it", () => {
    const { container } = render(<Entries entries={[RUN]} />);

    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.textContent).toBe(
      "Alternatively, see the Point Buy Calculator.",
    );
  });

  /**
   * The words survive, the anchor does not. An `internal` href addresses a page
   * this app does not serve, so linking it would send a reader nowhere — the
   * same call `hrefFor` makes when it returns null.
   */
  it("prints an internal link as plain words", () => {
    render(<Entries entries={[RUN]} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/Point Buy Calculator/)).toBeInTheDocument();
  });

  it("keeps an anchor for an address that resolves", () => {
    render(
      <Entries
        entries={[
          {
            type: "link",
            text: "the rules",
            href: { type: "external", url: "https://example.com/rules" },
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "the rules" })).toHaveAttribute(
      "href",
      "https://example.com/rules",
    );
  });

  /** Neither type reaches the coverage report any more. */
  it("is no longer reported as a gap", () => {
    resetCoverage();
    render(<Entries entries={[RUN]} />);

    expect(coverageReport().filter((gap) => gap.kind === "entry")).toEqual([]);
  });

  it("reports an unsupported structured child", () => {
    resetCoverage();
    render(
      <Entries
        context="Test section"
        entries={[{ type: "inline", entries: [{ type: "futureInline" }] }]}
      />,
    );

    expect(coverageReport()).toEqual([
      {
        kind: "entry",
        name: "futureInline",
        count: 1,
        firstSeenIn: "Test section",
      },
    ]);
  });
});

/**
 * An attack stored as fields rather than as a sentence.
 *
 * Only the 13 objects that fight back use this shape; the bestiary writes the
 * same line inline with `{@atk}` and `{@h}`. The point of the case under test
 * is that both arrive at the same rendered sentence — so what is asserted is
 * the sentence, not the structure.
 */
describe("a structured attack", () => {
  const BOLT: Entry = {
    type: "attack",
    attackType: "RW",
    attackEntries: ["{@hit +6} to hit, range 120/480 ft., one target."],
    hitEntries: ["16 ({@damage 3d10}) piercing damage."],
  };

  it("reads as the line the tags would have produced", () => {
    render(<Entries entries={[BOLT]} />);

    expect(screen.getByText("Ranged Weapon Attack:")).toBeInTheDocument();
    expect(screen.getByText("Hit:")).toBeInTheDocument();
    expect(screen.getByText(/\+6/)).toBeInTheDocument();
    expect(
      screen.getByText(/range 120\/480 ft\., one target\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/piercing damage\./)).toBeInTheDocument();
  });

  /** Two objects carry an attack with no damage clause of its own. */
  it("holds up when half the attack is missing", () => {
    render(<Entries entries={[{ type: "attack", attackType: "MW" }]} />);

    expect(screen.getByText("Melee Weapon Attack:")).toBeInTheDocument();
  });

  it("is not reported as a gap", () => {
    resetCoverage();
    render(<Entries entries={[BOLT]} />);

    expect(coverageReport().filter((gap) => gap.kind === "entry")).toEqual([]);
  });
});

/**
 * The adventure-shape diagram nine chapters open with.
 *
 * A container, which is what makes it worth its own test: one unhandled marker
 * used to drop all 115 blocks in the corpus, and a test that only checked the
 * outer type would not have noticed the prose going missing.
 */
describe("a flowchart", () => {
  /** Trimmed from IDRotF's "Welcome to the Far North". */
  const FLOWCHART: Entry = {
    type: "flowchart",
    blocks: [
      {
        type: "flowBlock",
        id: "015",
        name: "Chapter 1: Ten-Towns",
        page: 9,
        entries: [
          "{@i For 1st to 4th-level characters}",
          "Adventure quests prompt our intrepid heroes to visit the many settlements of Ten-Towns.",
        ],
      },
      {
        type: "flowBlock",
        id: "016",
        name: "Chapter 2: Icewind Dale",
        page: 9,
        entries: ["Tall tales lead the characters to adventure locations."],
      },
    ],
  };

  it("prints every block, headed and in order", () => {
    render(<Entries entries={[FLOWCHART]} />);

    const headings = screen.getAllByRole("heading");
    expect(headings.map((node) => node.textContent)).toEqual([
      "Chapter 1: Ten-Towns",
      "Chapter 2: Icewind Dale",
    ]);
    expect(
      screen.getByText(/visit the many settlements of Ten-Towns/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/lead the characters to adventure locations/),
    ).toBeInTheDocument();
  });

  /** A block's text is ordinary prose, so its tags are live. */
  it("renders a block's markup rather than printing it", () => {
    render(<Entries entries={[FLOWCHART]} />);

    expect(screen.getByText("For 1st to 4th-level characters")).toBeInTheDocument();
    expect(screen.queryByText(/\{@i/)).toBeNull();
  });

  /** Page numbers are print addressing and are shown nowhere in the reader. */
  it("does not print the page a step is described on", () => {
    const { container } = render(<Entries entries={[FLOWCHART]} />);

    expect(container.textContent).not.toContain("9");
  });

  /** 32 of the 115 blocks carry prose and no name. */
  it("holds up for a block with no name", () => {
    render(
      <Entries
        entries={[
          { type: "flowchart", blocks: [{ type: "flowBlock", entries: ["Just prose."] }] },
        ]}
      />,
    );

    expect(screen.getByText("Just prose.")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders nothing for a chart with no blocks", () => {
    const { container } = render(<Entries entries={[{ type: "flowchart" }]} />);

    // `Entries` always wraps in a stack, so the question is whether anything
    // was put in it — an empty box with a connector would be worse than none.
    expect(container.textContent).toBe("");
    expect(container.firstElementChild?.childElementCount).toBe(0);
  });

  it("is not reported as a gap", () => {
    resetCoverage();
    render(<Entries entries={[FLOWCHART]} />);

    expect(coverageReport().filter((gap) => gap.kind === "entry")).toEqual([]);
  });
});

/**
 * The passive check total, which the PHB states in words rather than deriving
 * from an ability the way its two siblings do. One occurrence in the corpus.
 */
describe("a stated formula", () => {
  const PASSIVE: Entry = {
    type: "abilityGeneric",
    text: "10 + all modifiers that normally apply to the check",
  };

  it("prints the formula it carries", () => {
    render(<Entries entries={[PASSIVE]} />);

    expect(
      screen.getByText("10 + all modifiers that normally apply to the check"),
    ).toBeInTheDocument();
  });

  it("renders nothing where there is no text", () => {
    const { container } = render(
      <Entries entries={[{ type: "abilityGeneric" }]} />,
    );

    expect(container.textContent).toBe("");
  });

  it("is not reported as a gap", () => {
    resetCoverage();
    render(<Entries entries={[PASSIVE]} />);

    expect(coverageReport().filter((gap) => gap.kind === "entry")).toEqual([]);
  });
});

/**
 * The PHB's list of conditions, and the Dungeon Kit's reprint of it.
 *
 * Named `inlineBlock`, but its sibling `inline` would be the wrong treatment:
 * that one closes a sentence back up into one paragraph and renders only
 * strings and links, so the list of fifteen names would vanish and report
 * itself as a gap. That is the regression this guards.
 */
describe("an inline block", () => {
  const CONDITIONS: Entry = {
    type: "inlineBlock",
    entries: [
      "For a full list of the conditions, see the page. The conditions are:",
      {
        type: "list",
        items: ["{@condition blinded}", "{@condition charmed}"],
        columns: 3,
      },
    ],
  };

  it("keeps the list its sibling treatment would drop", () => {
    const { container } = render(<Entries entries={[CONDITIONS]} />);

    expect(screen.getByText(/The conditions are:/)).toBeInTheDocument();
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("blinded")).toBeInTheDocument();
    expect(screen.getByText("charmed")).toBeInTheDocument();
  });

  it("is not reported as a gap, list and all", () => {
    resetCoverage();
    render(<Entries entries={[CONDITIONS]} />);

    expect(coverageReport().filter((gap) => gap.kind === "entry")).toEqual([]);
  });
});

/**
 * A trait's run-in label — "Amphibious." before the sentence it heads.
 *
 * The period belongs to the renderer, not to the data: nearly 24,000 labels
 * carry only the word, which read as "Amphibious The dragon can breathe air
 * and water" until this was supplied. The two exceptions are a name that
 * punctuates itself and `nameDot: false`, which is how a label says it runs
 * straight on into the sentence.
 */
describe("a run-in label", () => {
  const label = (entry: Entry) =>
    render(<Entries entries={[entry]} />).container.textContent;

  it("gains the period the data leaves to the renderer", () => {
    expect(
      label({
        type: "item",
        name: "Amphibious",
        entries: ["The dragon can breathe air and water."],
      }),
    ).toBe("Amphibious. The dragon can breathe air and water.");
  });

  it("does not punctuate a name that punctuates itself", () => {
    expect(
      label({ type: "item", name: "Who Goes There?", entries: ["Roll a d6."] }),
    ).toBe("Who Goes There? Roll a d6.");
  });

  it("leaves a name that already ends in a period alone", () => {
    expect(
      label({ type: "item", name: "Fire Breath.", entries: ["Roll a d6."] }),
    ).toBe("Fire Breath. Roll a d6.");
  });

  it("adds nothing when the name runs on into the sentence", () => {
    expect(
      label({
        type: "item",
        name: "Abjuration",
        nameDot: false,
        entries: ["spells are protective in nature."],
      }),
    ).toBe("Abjuration spells are protective in nature.");
  });
});

/**
 * The notes printed under a table.
 *
 * 129 tables carry `footnotes` and the field was never declared, so the note
 * was dropped and the asterisk in the cells above it pointed at nothing.
 */
describe("a table's footnotes", () => {
  const PACK: Entry = {
    type: "table",
    colLabels: ["Item", "Cost"],
    rows: [["Backpack*", "2 gp"]],
    footnotes: [
      "*You can also strap items, such as a bedroll, to the outside of a backpack.",
    ],
  };

  it("prints the note the asterisk stands for", () => {
    render(<Entries entries={[PACK]} />);

    expect(screen.getByText(/strap items, such as a bedroll/)).toBeInTheDocument();
  });

  it("keeps a cross-reference inside a note live", () => {
    render(
      <Entries
        entries={[{ ...PACK, footnotes: ["*While {@condition blinded}."] }]}
        refs={{
          "condition|blinded|phb": {
            name: "Blinded",
            entityType: "condition",
            href: "/compendium/conditions/phb/blinded",
          },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "blinded" })).toHaveAttribute(
      "href",
      "/compendium/conditions/phb/blinded",
    );
  });
});

/**
 * A header of more than one row, which the books use to group columns under a
 * shared heading. Three tables carry it as `colLabelRows` and carry no
 * `colLabels` at all, so a ten-column encounter table printed with no column
 * headings whatsoever.
 */
describe("a table's multi-row header", () => {
  const ENCOUNTERS: Entry = {
    type: "table",
    caption: "Wilderness Encounters",
    colLabelRows: [
      ["", { type: "cellHeader", entry: "Jungle", width: 3 }, ""],
      ["Encounter", "Beach", "No Undead", "Swamp", "Wasteland"],
    ],
    rows: [["Ghouls", "01–05", "—", "01–04", "—"]],
  };

  it("heads the columns a missing label row left bare", () => {
    render(<Entries entries={[ENCOUNTERS]} />);

    for (const label of ["Encounter", "Beach", "No Undead", "Wasteland"]) {
      expect(
        screen.getByRole("columnheader", { name: label }),
      ).toBeInTheDocument();
    }
  });

  it("stands a grouping heading over the columns it covers", () => {
    render(<Entries entries={[ENCOUNTERS]} />);

    expect(screen.getByRole("columnheader", { name: "Jungle" })).toHaveAttribute(
      "colspan",
      "3",
    );
  });
});

/**
 * What a screen reader announces for an illustration.
 *
 * 63 images describe themselves in `altText` and the renderer read only
 * `title`, which is the caption — so the description the books supply for
 * exactly this purpose went unread.
 */
describe("an illustration's alt text", () => {
  const image = (extra: Record<string, unknown>): Entry => ({
    type: "image",
    href: { type: "internal", path: "book/PHB/dwarf.webp" },
    ...extra,
  });

  it("announces the description over the caption", () => {
    render(
      <Entries
        context="Dwarf"
        entries={[image({ title: "A Mountain Dwarf", altText: "A dwarf in mail, axe over one shoulder" })]}
      />,
    );

    expect(
      screen.getByRole("img", { name: "A dwarf in mail, axe over one shoulder" }),
    ).toBeInTheDocument();
  });

  it("falls back to the caption, then to the entity", () => {
    render(<Entries context="Dwarf" entries={[image({ title: "A Mountain Dwarf" })]} />);
    expect(screen.getByRole("img", { name: "A Mountain Dwarf" })).toBeInTheDocument();

    render(<Entries context="Dwarf" entries={[image({})]} />);
    expect(screen.getByRole("img", { name: "Dwarf" })).toBeInTheDocument();
  });
});

/**
 * A book pointing at one of its own numbered locations.
 *
 * `{@area Aarakocra|59f|x}` addresses an entry by the id the source data hangs
 * on the node, not an entity by natural key — so the link and the thing it
 * lands on are both the renderer's job, and both are keyed on that id.
 */
describe("an area reference", () => {
  const ENCOUNTERS: Entry[] = [
    { type: "table", rows: [["{@area Aarakocra|59f|x}", "01–05"]] },
    { type: "entries", id: "59f", name: "Aarakocra", entries: ["Four aarakocra."] },
  ];

  it("links to the entry the id addresses", () => {
    render(
      <Entries entries={ENCOUNTERS} areas={{ "59f": "#59f" }} anchored={{ "59f": true }} />,
    );

    expect(screen.getByRole("link", { name: "Aarakocra" })).toHaveAttribute(
      "href",
      "#59f",
    );
  });

  it("marks the entry so the link has somewhere to land", () => {
    const { container } = render(
      <Entries entries={ENCOUNTERS} areas={{ "59f": "#59f" }} anchored={{ "59f": true }} />,
    );

    expect(container.querySelector('[id="59f"]')).toBeInTheDocument();
  });

  /** A target in another chapter is a real navigation, like the outline's. */
  it("crosses to another chapter when that is where the entry lives", () => {
    render(
      <Entries
        entries={[ENCOUNTERS[0]!]}
        areas={{ "59f": "/sources/toa/omu#59f" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Aarakocra" })).toHaveAttribute(
      "href",
      "/sources/toa/omu#59f",
    );
  });

  /**
   * An anchor to an element that is not on the page scrolls nowhere and reads
   * as broken, so an unresolved area keeps its words and drops the link.
   */
  it("stays plain words when the id resolves to nothing", () => {
    render(<Entries entries={[ENCOUNTERS[0]!]} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Aarakocra")).toBeInTheDocument();
  });

  /** 55,969 ids in the books; marking the ones nothing points at is markup for nobody. */
  it("leaves an entry unmarked when nothing points at it", () => {
    const { container } = render(<Entries entries={ENCOUNTERS} />);

    expect(container.querySelector('[id="59f"]')).toBeNull();
  });

  /** Some targets are bare images, which have no name to hang an id on. */
  it("marks a node that is not a named section", () => {
    const { container } = render(
      <Entries
        entries={[
          {
            type: "image",
            id: "0e5",
            href: { type: "internal", path: "book/ToA/map.webp" },
          },
        ]}
        anchored={{ "0e5": true }}
      />,
    );

    expect(container.querySelector('[id="0e5"]')).toBeInTheDocument();
  });

  /**
   * A gallery renders its images itself instead of handing them back to the
   * renderer, so it is the one place the mark has to be repeated — and it is
   * where the maps that BGDIA and VEoR point at happen to live.
   */
  it("marks an image inside a gallery", () => {
    const { container } = render(
      <Entries
        entries={[
          {
            type: "gallery",
            images: [
              {
                type: "image",
                id: "1a8",
                href: { type: "internal", path: "adventure/BGDIA/map.webp" },
              },
            ],
          },
        ]}
        anchored={{ "1a8": true }}
      />,
    );

    expect(container.querySelector('[id="1a8"]')).toBeInTheDocument();
  });

  it("is not reported as a gap", () => {
    resetCoverage();
    render(<Entries entries={ENCOUNTERS} areas={{ "59f": "#59f" }} />);

    expect(coverageReport()).toEqual([]);
  });
});

/**
 * The outline a page of prose emits.
 *
 * These assert elements, not type: a name that reads as a heading and is coded
 * as a bold span is invisible to anything navigating by heading, and that is
 * exactly what an option's name used to be. What the levels are worth visually
 * is a design call and belongs in the styles, but the shape below is what any
 * treatment has to hang on.
 */
describe("the heading over a named sub-section", () => {
  const NESTED: Entry = {
    type: "entries",
    name: "Racial Traits",
    entries: [
      {
        type: "entries",
        name: "Does Trance shorten a long rest?",
        entries: ["The elf finishes the rest after only 4 hours."],
      },
    ],
  };

  it("opens at the level the page hands it", () => {
    render(<Entries entries={[NESTED]} headingLevel={2} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Racial Traits" }),
    ).toBeInTheDocument();
  });

  it("steps a nested name down rather than repeating the one above it", () => {
    render(<Entries entries={[NESTED]} headingLevel={2} />);

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Does Trance shorten a long rest?",
      }),
    ).toBeInTheDocument();
  });

  /** The books nest deeper than the heading elements go. */
  it("stops descending at 5", () => {
    const deep = (depth: number): Entry =>
      depth === 0
        ? "The bottom."
        : { type: "entries", name: `Level ${depth}`, entries: [deep(depth - 1)] };

    render(<Entries entries={[deep(5)]} headingLevel={2} />);

    expect(
      screen.getAllByRole("heading").map((node) => node.tagName),
    ).toEqual(["H2", "H3", "H4", "H5", "H5"]);
  });

  it("emits no heading for a section that only groups", () => {
    const { container } = render(
      <Entries entries={[{ type: "entries", entries: ["Just prose."] }]} />,
    );

    expect(container.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
  });
});

describe("a name printed on a line of its own", () => {
  const OPTION: OptionalFeatureIndex = {
    "optionalfeature|archery|phb": {
      name: "Archery",
      prerequisite: null,
      entries: ["You gain a +2 bonus to ranged attack rolls."],
      sourceId: "PHB",
      sourceName: "Player's Handbook",
    },
  };

  it("makes an option's name a heading, not a bold span", () => {
    render(
      <Entries
        entries={[
          {
            type: "options",
            entries: [{ type: "refOptionalfeature", optionalfeature: "Archery" }],
          },
        ]}
        options={OPTION}
        headingLevel={4}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 4, name: "Archery" }),
    ).toBeInTheDocument();
  });

  /**
   * The label the books use most, and the one that must stay as it is: it names
   * a thing inside a sentence rather than opening one.
   */
  it("leaves a label that runs into its sentence alone", () => {
    const { container } = render(
      <Entries
        entries={[
          {
            type: "item",
            name: "Amphibious",
            entries: ["The dragon can breathe air and water."],
          },
        ]}
      />,
    );

    expect(container.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
    expect(container.textContent).toContain(
      "Amphibious. The dragon can breathe air and water.",
    );
  });

  it("heads a label whose body opens with a block instead", () => {
    render(
      <Entries
        entries={[
          {
            type: "item",
            name: "Light Armor",
            entries: [{ type: "list", items: ["Padded", "Leather"] }],
          },
        ]}
        headingLevel={4}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 4, name: "Light Armor" }),
    ).toBeInTheDocument();
  });
});
