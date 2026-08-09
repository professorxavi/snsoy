import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { SkillDetail } from "@/server/db/queries/skills";
import { SkillAside } from "./skill-aside";

/**
 * A skill in the aside.
 *
 * The class and race asides are summaries, and their tests are mostly about
 * what they leave for the page. This one has no page behind it, so the
 * assertion runs the other way: everything the skill says has to be here,
 * because there is nowhere else it could be said.
 */

const skill = (over: Partial<SkillDetail> = {}): SkillDetail =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    naturalKey: "skill|perception|phb",
    name: "Perception",
    slug: "perception",
    sourceId: "PHB",
    sourceName: "Player's Handbook",
    page: 178,
    ability: "wis",
    data: {
      entries: [
        "Your Wisdom (Perception) check lets you spot, hear, or otherwise detect the presence of something.",
        "It measures your general awareness of your surroundings.",
      ],
    },
    ...over,
  }) as unknown as SkillDetail;

describe("the skill aside", () => {
  it("identifies the skill and where it was printed", () => {
    render(<SkillAside skill={skill()} refs={{}} />);

    expect(
      screen.getByRole("heading", { name: "Perception" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Player's Handbook/)).toBeInTheDocument();
    expect(screen.getByText(/p\. 178/)).toBeInTheDocument();
  });

  /** The ability is the one thing a reader needs before the prose. */
  it("names the check in the form the rules use", () => {
    render(<SkillAside skill={skill()} refs={{}} />);

    expect(screen.getByText("Wisdom (Perception)")).toBeInTheDocument();
  });

  /**
   * The decision this component exists to carry. If it ever starts printing an
   * opening paragraph and a "read the rest" link, a skill has silently become
   * something that needs a page.
   */
  it("prints the whole skill rather than an opening", () => {
    render(<SkillAside skill={skill()} refs={{}} />);

    expect(screen.getByText(/lets you spot, hear/)).toBeInTheDocument();
    expect(screen.getByText(/general awareness/)).toBeInTheDocument();
  });

  it("offers no way out to a page that does not exist", () => {
    render(<SkillAside skill={skill()} refs={{}} />);

    const destinations = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(destinations).toEqual(["/sources/phb"]);
  });

  /** A generic entity's blob has no schema behind it to guarantee an ability. */
  it("falls back to the name alone when the data carries no ability", () => {
    render(<SkillAside skill={skill({ ability: null })} refs={{}} />);

    expect(screen.queryByText("Wisdom (Perception)")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Perception" }),
    ).toBeInTheDocument();
  });
});
