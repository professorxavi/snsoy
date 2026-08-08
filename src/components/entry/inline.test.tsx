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
