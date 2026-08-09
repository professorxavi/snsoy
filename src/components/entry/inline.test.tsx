import { describe, expect, it } from "vitest";
import type { ReferenceIndex } from "@/lib/content/references";
import { render, screen } from "@/test/render";
import { resetCoverage, coverageReport } from "./coverage";
import { Inline } from "./inline";

/**
 * The renderer's output, not its inputs.
 *
 * `references.test.ts` already proves which natural key a tag resolves to;
 * nothing proved what the reader ends up looking at. The failures this covers
 * are the ones that survive a green resolver: a tag that resolves but renders
 * as raw markup, a link that points at the page it is already on, or an
 * unhandled tag that disappears silently instead of being flagged.
 */

const REFS: ReferenceIndex = {
  "spell|fireball|phb": {
    name: "Fireball",
    entityType: "spell",
    href: "/compendium/spells/phb/fireball",
  },
  "condition|prone|phb": {
    name: "Prone",
    entityType: "condition",
    href: null,
  },
};

describe("Inline", () => {
  it("leaves text with no markup exactly as it was", () => {
    render(<Inline text="A plain sentence." />);

    expect(screen.getByText("A plain sentence.")).toBeInTheDocument();
  });

  describe("cross-references", () => {
    /**
     * The link text is the tag's, not the entity's. Tags sit mid-sentence in
     * hand-written prose, so substituting the canonical name would capitalise
     * a word in the middle of a sentence — "A Fireball erupts."
     */
    it("links a resolved tag to the entity's page, keeping the author's casing", () => {
      render(<Inline text="A {@spell fireball} erupts." refs={REFS} />);

      const link = screen.getByRole("link", { name: "fireball" });
      expect(link).toHaveAttribute("href", "/compendium/spells/phb/fireball");
    });

    it("prefers the tag's display text over the entity's name", () => {
      render(<Inline text="{@spell fireball|phb|a fiery blast}" refs={REFS} />);

      expect(
        screen.getByRole("link", { name: "a fiery blast" }),
      ).toBeInTheDocument();
    });

    /**
     * The reader is already on the page, so a link would go nowhere useful.
     * Losing the text entirely is the failure worth catching here.
     */
    it("renders the entity's own name as text, not a link to itself", () => {
      render(
        <Inline
          text="A {@spell fireball} erupts."
          refs={REFS}
          selfKey="spell|fireball|phb"
        />,
      );

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText(/fireball/)).toBeInTheDocument();
    });

    /** Resolved, but with no page of its own — the name still has to show. */
    it("renders an addressless target as plain text", () => {
      render(<Inline text="Knocked {@condition prone}." refs={REFS} />);

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText(/prone/)).toBeInTheDocument();
    });

    /**
     * With no index every tag is unresolved, which is what a page renders
     * before its references load. It must degrade to readable prose rather
     * than leaking corpus markup.
     */
    it("falls back to the label when nothing resolves", () => {
      render(<Inline text="A {@spell fireball} erupts." />);

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(document.body.textContent).not.toContain("{@");
      expect(screen.getByText(/fireball/)).toBeInTheDocument();
    });
  });

  describe("emphasis", () => {
    it("maps each format tag to its element", () => {
      const { container } = render(
        <Inline text="{@b bold} {@i italic} {@s struck} {@note aside}" />,
      );

      expect(container.querySelector("strong")).toHaveTextContent("bold");
      expect(container.querySelector("em")).toHaveTextContent("italic");
      expect(container.querySelector("s")).toHaveTextContent("struck");
    });

    /** Real markup: flattening the outer tag would drop the link inside it. */
    it("keeps a reference nested inside a format tag", () => {
      const { container } = render(
        <Inline text="{@b {@spell fireball}}" refs={REFS} />,
      );

      const link = screen.getByRole("link", { name: "fireball" });
      expect(container.querySelector("strong")).toContainElement(link);
    });
  });

  describe("rolls", () => {
    /**
     * Rolls navigate nowhere, so rendering one as a link would promise a
     * destination that does not exist.
     */
    it("renders a damage roll as text rather than a link", () => {
      render(<Inline text="Takes {@damage 8d6} fire damage." />);

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText("8d6")).toBeInTheDocument();
    });

    /**
     * The corpus writes the tag where the parentheses go — an action named
     * "Fire Breath {@recharge 5}" is printed "Fire Breath (Recharge 5–6)" —
     * so the tag supplies them.
     */
    it("parenthesises a recharge and completes its range", () => {
      render(<Inline text="Fire Breath {@recharge 5}" />);

      expect(screen.getByText("(Recharge 5–6)")).toBeInTheDocument();
    });

    it("defaults a bare recharge to a 6", () => {
      render(<Inline text="Tail Spike {@recharge}" />);

      expect(screen.getByText("(Recharge 6)")).toBeInTheDocument();
    });

    /** `{@skillCheck animal_handling 5}` packs both values into one part. */
    it("reads a skill check as its skill and bonus", () => {
      render(<Inline text="Make a {@skillCheck animal_handling 5} check." />);

      expect(screen.getByText("Animal Handling +5")).toBeInTheDocument();
    });

    /** A number the book cannot print, because it is the reader's own. */
    it("stands in for the reader's spell attack modifier", () => {
      resetCoverage();
      render(<Inline text="Add {@hitYourSpellAttack} to the roll." />);

      expect(screen.getByText("your spell attack modifier")).toBeInTheDocument();
      expect(coverageReport()).toEqual([]);
    });
  });

  /**
   * The labels a stat block's actions are built around. Together they are the
   * most frequent markup in the bestiary — 11,496 occurrences — and every one
   * of them rendered as an unsupported-tag marker until they were handled.
   */
  describe("attack cues", () => {
    it("expands an attack code into the line print sets", () => {
      render(<Inline text="{@atk mw} {@hit 14} to hit." />);

      expect(screen.getByText("Melee Weapon Attack:")).toBeInTheDocument();
    });

    /**
     * Two codes are one attack usable two ways, not two attacks — so the kind
     * is said once. Read naively this comes out as "Melee Weapon or Ranged
     * Weapon Attack".
     */
    it("combines two codes into one phrase", () => {
      render(<Inline text="{@atk mw,rw} to hit." />);

      expect(
        screen.getByText("Melee or Ranged Weapon Attack:"),
      ).toBeInTheDocument();
    });

    it("omits the kind from a code that names only its reach", () => {
      render(<Inline text="{@atk m} to hit." />);

      expect(screen.getByText("Melee Attack:")).toBeInTheDocument();
    });

    it("names the spell attacks", () => {
      render(<Inline text="{@atk ms,rs} to hit." />);

      expect(
        screen.getByText("Melee or Ranged Spell Attack:"),
      ).toBeInTheDocument();
    });

    /**
     * The corpus writes `{@h}19` with nothing between the tag and the number,
     * so the separator has to come from the tag or the line reads "Hit:19".
     */
    it("introduces the damage, separator included", () => {
      resetCoverage();
      const { container } = render(<Inline text="{@h}19 piercing damage." />);

      expect(screen.getByText("Hit:")).toBeInTheDocument();
      expect(container.textContent).toBe("Hit: 19 piercing damage.");
      expect(coverageReport()).toEqual([]);
    });

    it("introduces damage that lands either way", () => {
      render(<Inline text="{@hom}10 fire damage." />);

      expect(screen.getByText("Hit or Miss:")).toBeInTheDocument();
    });
  });

  describe("gaps", () => {
    it("shows an unknown tag's text and records it as a gap", () => {
      resetCoverage();
      render(<Inline text="A {@somethingNew widget} appears." context="Test" />);

      expect(screen.getByText(/widget/)).toBeInTheDocument();
      expect(coverageReport()).toEqual([
        { kind: "tag", name: "somethingNew", count: 1, firstSeenIn: "Test" },
      ]);
    });

    /** A recognised-but-inert tag is not a gap, and must not be reported. */
    it("leaves a deferred tag out of the report", () => {
      resetCoverage();
      render(<Inline text="Take {@quickref Cover||3||half cover}." />);

      expect(screen.getByText(/half cover/)).toBeInTheDocument();
      expect(coverageReport()).toEqual([]);
    });
  });
});
