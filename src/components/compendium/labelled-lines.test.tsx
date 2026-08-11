import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { LabelledLines } from "./labelled-lines";

/**
 * The lines three of the lore types print instead of prose.
 *
 * Two things here are worth pinning. A line with nothing behind it must not
 * render at all — most deities carry two of the four, and a "Province." with
 * nothing after it reads as a bug. And the text is markup: a cult's signature
 * spells are `{@spell}` tags, and printing them flat would lose the one thing
 * that makes that line worth having.
 */

describe("LabelledLines", () => {
  it("prints a label and its text", () => {
    render(
      <LabelledLines
        lines={[{ label: "Alignment.", text: "Chaotic Good" }]}
        refs={{}}
      />,
    );

    expect(screen.getByText("Alignment.")).toBeInTheDocument();
    expect(screen.getByText("Chaotic Good")).toBeInTheDocument();
  });

  it("drops a line the entity does not carry", () => {
    render(
      <LabelledLines
        lines={[
          { label: "Goal.", text: "Restoration of honour" },
          { label: "Typical Cultists.", text: null },
          { label: "Signature Spells.", text: "" },
        ]}
        refs={{}}
      />,
    );

    expect(screen.getByText("Goal.")).toBeInTheDocument();
    expect(screen.queryByText("Typical Cultists.")).toBeNull();
    expect(screen.queryByText("Signature Spells.")).toBeNull();
  });

  it("renders nothing at all when no line has anything", () => {
    const { container } = render(
      <LabelledLines lines={[{ label: "Goal.", text: null }]} refs={{}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  /** The tag resolves through the same index the prose uses. */
  it("opens what a line names", () => {
    render(
      <LabelledLines
        lines={[{ label: "Signature Spells.", text: "{@spell hex} (1st level)" }]}
        refs={{
          "spell|hex|phb": {
            name: "hex",
            entityType: "spell",
            href: "/compendium/spells/phb/hex",
          },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "hex" })).toHaveAttribute(
      "href",
      "/compendium/spells/phb/hex",
    );
  });
});
