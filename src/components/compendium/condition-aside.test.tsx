import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { ConditionDetail } from "@/server/db/queries/conditions";
import { ConditionAside } from "./condition-aside";

/**
 * A condition in the aside.
 *
 * There is no page behind it, so the assertion that matters is that everything
 * the condition says is here — and that the conditions it names in passing are
 * live, since four of the fifteen open by citing another one.
 */

const condition = (over: Partial<ConditionDetail> = {}): ConditionDetail =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    naturalKey: "condition|stunned|phb",
    name: "Stunned",
    slug: "stunned",
    sourceId: "PHB",
    sourceName: "Player's Handbook",
    page: 292,
    data: {
      entries: [
        {
          type: "list",
          items: [
            "A stunned creature is {@condition incapacitated}, can't move, and can speak only falteringly.",
            "Attack rolls against the creature have advantage.",
          ],
        },
      ],
    },
    ...over,
  }) as unknown as ConditionDetail;

const refs = {
  "condition|incapacitated|phb": {
    name: "Incapacitated",
    entityType: "condition" as const,
    href: "/compendium/conditions/phb/incapacitated",
  },
};

describe("the condition aside", () => {
  it("identifies the condition and where it was printed", () => {
    render(<ConditionAside condition={condition()} refs={{}} />);

    expect(screen.getByRole("heading", { name: "Stunned" })).toBeInTheDocument();
    expect(screen.getByText(/Player's Handbook/)).toBeInTheDocument();
    expect(screen.getByText(/p\. 292/)).toBeInTheDocument();
  });

  /** Every effect, not an opening line — there is nowhere else to read them. */
  it("prints the whole list of effects", () => {
    render(<ConditionAside condition={condition()} refs={{}} />);

    expect(screen.getByText(/can speak only falteringly/)).toBeInTheDocument();
    expect(
      screen.getByText(/Attack rolls against the creature have advantage/),
    ).toBeInTheDocument();
  });

  /**
   * What makes reading conditions in the aside work at all: Stunned cites
   * Incapacitated, and the citation has to be something you can open rather
   * than a word you have to go and look up.
   */
  it("leaves the conditions it cites as links", () => {
    render(<ConditionAside condition={condition()} refs={refs} />);

    // Named as the sentence names it, not as the entity is titled — the tag
    // carries its own display text and the renderer keeps it.
    expect(screen.getByRole("link", { name: "incapacitated" })).toHaveAttribute(
      "href",
      "/compendium/conditions/phb/incapacitated",
    );
  });

  it("offers no way out to a page that does not exist", () => {
    render(<ConditionAside condition={condition()} refs={{}} />);

    const destinations = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(destinations).toEqual(["/sources/phb"]);
  });
});
