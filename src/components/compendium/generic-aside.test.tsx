import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { FieldMap, GenericDetail } from "@/server/db/queries/generic";
import { GenericAside } from "./generic-aside";

/**
 * A generic entity in the aside.
 *
 * The class and race asides are summaries, and their tests are mostly about
 * what they leave for the page. This one has no page behind it, so the
 * assertion runs the other way: everything the entity says has to be here,
 * because there is nowhere else it could be said.
 */

const entity = (
  over: Partial<GenericDetail<FieldMap>> = {},
): GenericDetail<FieldMap> =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    naturalKey: "sense|darkvision|phb",
    name: "Darkvision",
    slug: "darkvision",
    sourceId: "PHB",
    sourceName: "Player's Handbook",
    page: 183,
    data: {
      entries: [
        "Many creatures in fantasy gaming worlds have darkvision.",
        "Within a specified range, a creature with darkvision can see in darkness as if it were dim light.",
      ],
    },
    ...over,
  }) as unknown as GenericDetail<FieldMap>;

describe("the generic entity aside", () => {
  it("identifies the entity and where it was printed", () => {
    render(<GenericAside entity={entity()} refs={{}} />);

    expect(
      screen.getByRole("heading", { name: "Darkvision" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Player's Handbook/)).toBeInTheDocument();
    expect(screen.getByText(/p\. 183/)).toBeInTheDocument();
  });

  /**
   * The decision this component exists to carry. If it ever starts printing an
   * opening paragraph and a "read the rest" link, one of these types has
   * silently become something that needs a page.
   */
  it("prints the whole entity rather than an opening", () => {
    render(<GenericAside entity={entity()} refs={{}} />);

    expect(screen.getByText(/have darkvision/)).toBeInTheDocument();
    expect(screen.getByText(/as if it were dim light/)).toBeInTheDocument();
  });

  it("offers no way out to a page that does not exist", () => {
    render(<GenericAside entity={entity()} refs={{}} />);

    const destinations = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(destinations).toEqual(["/sources/phb"]);
  });

  /**
   * The only per-type difference. A skill states the check it rolls and an
   * action how long it takes; a condition has no second fact about it, and a
   * panel that printed an empty italic line above the prose would be saying
   * there is one.
   */
  describe("the subtitle", () => {
    it("states the type's second fact when it has one", () => {
      render(
        <GenericAside
          entity={entity()}
          refs={{}}
          subtitle="Wisdom (Perception)"
        />,
      );

      expect(screen.getByText("Wisdom (Perception)")).toBeInTheDocument();
    });

    it("leaves no room where the type has none", () => {
      const withSubtitle = render(
        <GenericAside entity={entity()} refs={{}} subtitle="Wisdom (Perception)" />,
      );
      const followingH1 = () =>
        withSubtitle.container.querySelectorAll("h1 ~ *").length;

      // Stated against the case that does print one, so an assertion that
      // matched nothing either way would fail here rather than pass quietly.
      expect(followingH1()).toBe(1);

      withSubtitle.unmount();
      const bare = render(<GenericAside entity={entity()} refs={{}} />);

      expect(bare.container.querySelectorAll("h1 ~ *")).toHaveLength(0);
    });

    /** A generic entity's blob has no schema behind it to guarantee a field. */
    it("prints nothing when the data did not fill the field in", () => {
      render(<GenericAside entity={entity()} refs={{}} subtitle={null} />);

      expect(
        screen.getByRole("heading", { name: "Darkvision" }),
      ).toBeInTheDocument();
    });
  });

  /** Not every book records a page for every entry. */
  it("names the source alone when there is no page number", () => {
    render(<GenericAside entity={entity({ page: null })} refs={{}} />);

    expect(screen.getByText(/Player's Handbook/)).toBeInTheDocument();
    expect(screen.queryByText(/p\./)).not.toBeInTheDocument();
  });
});
