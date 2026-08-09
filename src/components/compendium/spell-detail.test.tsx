import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { InboundReference } from "@/server/db/queries/references";
import type { SpellDetail as SpellDetailData } from "@/server/db/queries/spells";
import { SpellDetail } from "./spell-detail";

/**
 * What the two densities agree on, and the one thing they do not.
 *
 * The spell itself has to read identically in the aside and on the page — they
 * are the same spell at the same URL, and a difference between them is a
 * difference nobody asked for. "Referenced by" is the deliberate exception: an
 * aside carries the entity and nothing about the entity's place in the corpus.
 */

const spell = (): SpellDetailData =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    naturalKey: "spell|fireball|phb",
    name: "Fireball",
    slug: "fireball",
    sourceId: "PHB",
    sourceName: "Player's Handbook",
    page: 241,
    isSrd: true,
    level: 3,
    school: "V",
    isConcentration: false,
    isRitual: false,
    classes: ["Sorcerer", "Wizard"],
    subclasses: null,
    time: [{ number: 1, unit: "action" }],
    range: { type: "point", distance: { type: "feet", amount: 150 } },
    components: { v: true, s: true, m: "a tiny ball of bat guano" },
    duration: [{ type: "instant" }],
    data: { entries: ["A bright streak flashes from your pointing finger."] },
  }) as unknown as SpellDetailData;

const inbound: InboundReference[] = [
  {
    id: "1",
    name: "Fire Giant",
    entityType: "monster",
    sourceId: "MM",
    href: "/compendium/monsters/mm/fire-giant",
  },
];

describe("a spell at page density", () => {
  it("says what refers to it", () => {
    render(<SpellDetail spell={spell()} refs={{}} inbound={inbound} />);

    expect(screen.getByText("Referenced by")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fire Giant" })).toBeInTheDocument();
  });
});

describe("a spell at aside density", () => {
  /**
   * The rule this test exists for. Fireball is referred to 224 times, and a
   * reader who opened it from a sentence they were reading wants the spell —
   * not every creature that throws one.
   */
  it("never says what refers to it, even when told", () => {
    render(
      <SpellDetail
        spell={spell()}
        refs={{}}
        inbound={inbound}
        density="aside"
      />,
    );

    expect(screen.queryByText("Referenced by")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fire Giant" })).toBeNull();
  });

  it("still prints everything the book prints about the spell", () => {
    render(<SpellDetail spell={spell()} refs={{}} density="aside" />);

    expect(screen.getByRole("heading", { name: "Fireball" })).toBeInTheDocument();
    expect(screen.getByText("3rd-level evocation")).toBeInTheDocument();
    expect(screen.getByText("1 action")).toBeInTheDocument();
    expect(screen.getByText(/bright streak flashes/)).toBeInTheDocument();
  });
});
