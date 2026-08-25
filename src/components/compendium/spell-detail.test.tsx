import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { SpellDetail as SpellDetailData } from "@/server/db/queries/spells";
import { SpellDetail } from "./spell-detail";

/**
 * The aside and the page are the same spell.
 *
 * They share a URL, and `density` is now purely a matter of size — so there is
 * no per-density behaviour left to pin, only the guarantee that everything the
 * book prints about a spell survives at the narrower one.
 *
 * The page used to carry a "Referenced by" list that the aside withheld. It was
 * removed: what cites a spell is a fact about the books, not about the spell.
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

describe("a spell at aside density", () => {
  it("still prints everything the book prints about the spell", () => {
    render(<SpellDetail spell={spell()} refs={{}} density="aside" />);

    expect(screen.getByRole("heading", { name: "Fireball" })).toBeInTheDocument();
    expect(screen.getByText("3rd-level evocation")).toBeInTheDocument();
    expect(screen.getByText("1 action")).toBeInTheDocument();
    expect(screen.getByText(/bright streak flashes/)).toBeInTheDocument();
  });
});
