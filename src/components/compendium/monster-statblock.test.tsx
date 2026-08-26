import { describe, expect, it } from "vitest";
import { coverageReport, resetCoverage } from "@/components/entry/coverage";
import type { ReferenceIndex } from "@/lib/content/references";
import type { MonsterDetail } from "@/server/db/queries/monsters";
import { render, screen } from "@/test/render";
import { MonsterStatblock } from "./monster-statblock";

/**
 * The stat block as a reader meets it.
 *
 * `monsters.test.ts` proves each value formats correctly; nothing there proves
 * they reach the panel, are labelled, or appear under the right heading. The
 * failures this covers are the ones that survive green formatters: a group
 * printed with no entries, a trait that arrives untyped and renders as an
 * unsupported block, spellcasting filed as a trait when the creature casts it
 * as an action, and an empty pair of rules closing on nothing.
 */

const REFS: ReferenceIndex = {
  "condition|frightened|phb": {
    name: "Frightened",
    entityType: "condition",
    href: "/compendium/conditions/phb/frightened",
  },
  "spell|mage armor|phb": {
    name: "Mage Armor",
    entityType: "spell",
    href: "/compendium/spells/phb/mage-armor",
  },
};

function monster(data: Record<string, unknown>): MonsterDetail {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    naturalKey: "monster|adult red dragon|mm",
    name: "Adult Red Dragon",
    slug: "adult-red-dragon",
    sourceId: "MM",
    page: 98,
    sourceName: "Monster Manual",
    crDisplay: "17",
    isLegendary: true,
    fluff: null,
    data,
  } as MonsterDetail;
}

/** The shape of a complete stat block, trimmed to what a test needs to see. */
const DRAGON = {
  name: "Adult Red Dragon",
  size: ["H"],
  type: "dragon",
  alignment: ["C", "E"],
  ac: [{ ac: 19, from: ["natural armor"] }],
  hp: { average: 256, formula: "19d12 + 133" },
  speed: { walk: 40, climb: 40, fly: 80 },
  str: 27,
  dex: 10,
  con: 25,
  int: 16,
  wis: 13,
  cha: 21,
  save: { dex: "+6", con: "+13", wis: "+7", cha: "+11" },
  skill: { perception: "+13", stealth: "+6" },
  immune: ["fire"],
  senses: ["blindsight 60 ft.", "darkvision 120 ft."],
  passive: 23,
  languages: ["Common", "Draconic"],
  cr: "17",
  trait: [
    {
      name: "Legendary Resistance (3/Day)",
      entries: ["If the dragon fails a saving throw, it can choose to succeed instead."],
    },
  ],
  action: [
    {
      name: "Bite",
      entries: [
        "{@atk mw} {@hit 14} to hit, reach 10 ft., one target. {@h}19 ({@damage 2d10 + 8}) piercing damage.",
      ],
    },
  ],
  legendary: [
    { name: "Detect", entries: ["The dragon makes a Wisdom (Perception) check."] },
  ],
};

describe("MonsterStatblock", () => {
  it("leads with the creature, its book and what it is", () => {
    render(
      <MonsterStatblock monster={monster(DRAGON)} refs={REFS} density="aside" />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Adult Red Dragon" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Huge dragon, chaotic evil")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Monster Manual" })).toHaveAttribute(
      "href",
      "/sources/mm",
    );
  });

  it("labels every line of the header", () => {
    render(<MonsterStatblock monster={monster(DRAGON)} refs={REFS} />);

    for (const label of [
      "Armor Class",
      "Hit Points",
      "Speed",
      "Saving Throws",
      "Skills",
      "Damage Immunities",
      "Senses",
      "Languages",
      "Challenge",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText(/19 \(natural armor\)/)).toBeInTheDocument();
    expect(screen.getByText(/17 \(18,000 XP\)/)).toBeInTheDocument();
  });

  it("prints the six scores with their modifiers", () => {
    render(<MonsterStatblock monster={monster(DRAGON)} refs={REFS} />);

    for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
      expect(screen.getByText(ability)).toBeInTheDocument();
    }
    expect(screen.getByText("27")).toBeInTheDocument();
    expect(screen.getByText("(+8)")).toBeInTheDocument();
  });

  /**
   * The attack line was the single largest gap in the renderer: `{@atk}` and
   * `{@h}` occur 11,496 times across the bestiary and rendered as red
   * unsupported-tag markers on every creature that attacks.
   */
  it("sets the attack cues rather than flagging them as unsupported", () => {
    resetCoverage();
    render(<MonsterStatblock monster={monster(DRAGON)} refs={REFS} />);

    expect(screen.getByText("Melee Weapon Attack:")).toBeInTheDocument();
    expect(screen.getByText("Hit:")).toBeInTheDocument();
    expect(coverageReport()).toEqual([]);
  });

  it("heads the groups a creature actually has", () => {
    render(<MonsterStatblock monster={monster(DRAGON)} refs={REFS} />);

    expect(screen.getByRole("heading", { name: "Actions" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Legendary Actions" }),
    ).toBeInTheDocument();

    // Traits are unheaded in print — they are simply what the creature is.
    expect(screen.getByText("Legendary Resistance (3/Day)")).toBeInTheDocument();
  });

  /** A heading with nothing under it reads as content that failed to load. */
  it("omits a group the creature has none of", () => {
    render(<MonsterStatblock monster={monster(DRAGON)} refs={REFS} />);

    expect(screen.queryByRole("heading", { name: "Reactions" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Mythic Actions" })).toBeNull();
  });

  /** 341 of the 351 legendary creatures store no header of their own. */
  it("supplies the legendary preamble the corpus leaves out", () => {
    render(<MonsterStatblock monster={monster(DRAGON)} refs={REFS} />);

    expect(
      screen.getByText(/The dragon can take 3 legendary actions/),
    ).toBeInTheDocument();
  });

  it("prefers the creature's own legendary preamble where it has one", () => {
    render(
      <MonsterStatblock
        monster={monster({
          ...DRAGON,
          legendaryHeader: ["The dragon acts twice, and never on your turn."],
        })}
        refs={REFS}
      />,
    );

    expect(
      screen.getByText("The dragon acts twice, and never on your turn."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/can take 3 legendary actions/)).toBeNull();
  });

  it("keeps a cross-reference inside a trait live", () => {
    render(
      <MonsterStatblock
        monster={monster({
          ...DRAGON,
          trait: [
            {
              name: "Frightful Presence",
              entries: ["The target becomes {@condition frightened} for 1 minute."],
            },
          ],
        })}
        refs={REFS}
      />,
    );

    expect(screen.getByRole("link", { name: "frightened" })).toHaveAttribute(
      "href",
      "/compendium/conditions/phb/frightened",
    );
  });

  /** An AC raised by a spell cites the spell, and the citation is a real link. */
  it("links out of the armour class", () => {
    render(
      <MonsterStatblock
        monster={monster({
          ...DRAGON,
          ac: [13, { ac: 16, braces: true, condition: "with {@spell mage armor}" }],
        })}
        refs={REFS}
      />,
    );

    expect(screen.getByRole("link", { name: "mage armor" })).toHaveAttribute(
      "href",
      "/compendium/spells/phb/mage-armor",
    );
  });

  describe("spellcasting", () => {
    const CASTER = {
      ...DRAGON,
      spellcasting: [
        {
          name: "Innate Spellcasting",
          type: "spellcasting",
          ability: "cha",
          headerEntries: ["It can innately cast the following spells:"],
          will: ["{@spell mage armor}"],
          daily: { "1e": ["{@spell mage armor}"] },
        },
      ],
    };

    it("prints the groups with the frequency the keys encode", () => {
      render(<MonsterStatblock monster={monster(CASTER)} refs={REFS} />);

      expect(screen.getByText("At will:")).toBeInTheDocument();
      expect(screen.getByText("1/day each:")).toBeInTheDocument();
    });

    /**
     * 473 of 1,263 blocks are cast as actions rather than possessed as a trait,
     * and filing one under the wrong heading changes what the creature can do
     * in a round.
     */
    it("files a block under Actions when it says to display it there", () => {
      render(
        <MonsterStatblock
          monster={monster({
            ...DRAGON,
            action: [],
            spellcasting: [{ ...CASTER.spellcasting[0], displayAs: "action" }],
          })}
          refs={REFS}
        />,
      );

      expect(screen.getByRole("heading", { name: "Actions" })).toBeInTheDocument();
      expect(screen.getByText("Innate Spellcasting")).toBeInTheDocument();
    });

    /** 35 blocks carry no `type`, and an untyped one renders as an error box. */
    it("renders a block that never declared its type", () => {
      resetCoverage();
      render(
        <MonsterStatblock
          monster={monster({
            ...DRAGON,
            spellcasting: [
              {
                name: "Innate Spellcasting",
                will: ["{@spell mage armor}"],
              },
            ],
          })}
          refs={REFS}
        />,
      );

      expect(screen.getByText("At will:")).toBeInTheDocument();
      expect(coverageReport()).toEqual([]);
    });

    /** 57 blocks name a group something else already prints. */
    it("does not print a group the block hides", () => {
      render(
        <MonsterStatblock
          monster={monster({
            ...DRAGON,
            spellcasting: [{ ...CASTER.spellcasting[0], hidden: ["will"] }],
          })}
          refs={REFS}
        />,
      );

      expect(screen.queryByText("At will:")).toBeNull();
      expect(screen.getByText("1/day each:")).toBeInTheDocument();
    });

    it("counts the slots of a levelled caster", () => {
      render(
        <MonsterStatblock
          monster={monster({
            ...DRAGON,
            spellcasting: [
              {
                name: "Spellcasting",
                type: "spellcasting",
                spells: {
                  "0": { spells: ["{@spell mage armor}"] },
                  "1": { slots: 4, spells: ["{@spell mage armor}"] },
                },
              },
            ],
          })}
          refs={REFS}
        />,
      );

      expect(screen.getByText("Cantrips (at will):")).toBeInTheDocument();
      expect(screen.getByText("1st level (4 slots):")).toBeInTheDocument();
    });
  });

  /** Templates and a few NPC blocks carry no scores at all. */
  it("drops the ability table when a creature has no scores", () => {
    const scoreless: Record<string, unknown> = { ...DRAGON };
    for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
      delete scoreless[ability];
    }

    render(<MonsterStatblock monster={monster(scoreless)} refs={REFS} />);

    expect(screen.queryByText("str")).toBeNull();
    expect(screen.getByText("Armor Class")).toBeInTheDocument();
  });

  /** A creature with nothing but the three mandatory lines still reads. */
  it("renders a creature with none of the optional qualities", () => {
    resetCoverage();
    render(
      <MonsterStatblock
        monster={monster({
          name: "Rat",
          size: ["T"],
          type: "beast",
          alignment: ["U"],
          ac: [10],
          hp: { average: 1, formula: "1d4 - 1" },
          speed: { walk: 20 },
          str: 2,
          dex: 11,
          con: 9,
          int: 2,
          wis: 10,
          cha: 4,
          passive: 10,
          cr: "0",
        })}
        refs={REFS}
      />,
    );

    expect(screen.getByText("Tiny beast, unaligned")).toBeInTheDocument();
    expect(screen.getByText(/passive Perception 10/)).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Saving Throws")).toBeNull();
    expect(coverageReport()).toEqual([]);
  });
});

/**
 * The one thing `density` decides.
 *
 * The block renders in two places that must not drift: the 400px panel, where
 * it owns the source line and the name, and the creature's own page, where the
 * header above it does and a second `h1` would be the bug. The creature line
 * belongs to the block either way — in print it sits directly under the name,
 * as much a part of the block as the armour class.
 */
describe("the two densities", () => {
  it("leaves the identity to the page header at page density", () => {
    render(<MonsterStatblock monster={monster(DRAGON)} refs={REFS} />);

    expect(screen.queryByRole("heading", { name: "Adult Red Dragon" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Monster Manual" })).toBeNull();
  });

  it("prints the creature line at both densities", () => {
    const { unmount } = render(
      <MonsterStatblock monster={monster(DRAGON)} refs={REFS} density="aside" />,
    );
    expect(screen.getByText("Huge dragon, chaotic evil")).toBeInTheDocument();
    unmount();

    render(<MonsterStatblock monster={monster(DRAGON)} refs={REFS} />);
    expect(screen.getByText("Huge dragon, chaotic evil")).toBeInTheDocument();
  });

  /** The numbers are the same numbers; only the chrome around them differs. */
  it("prints the same stat lines either way", () => {
    const { unmount } = render(
      <MonsterStatblock monster={monster(DRAGON)} refs={REFS} density="aside" />,
    );
    expect(screen.getByText("Armor Class")).toBeInTheDocument();
    expect(screen.getByText(/19 \(natural armor\)/)).toBeInTheDocument();
    unmount();

    render(<MonsterStatblock monster={monster(DRAGON)} refs={REFS} />);
    expect(screen.getByText("Armor Class")).toBeInTheDocument();
    expect(screen.getByText(/19 \(natural armor\)/)).toBeInTheDocument();
  });
});
