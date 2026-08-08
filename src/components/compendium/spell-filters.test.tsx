import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/test/render";
import type {
  FacetOption,
  SpellFacetOptions,
} from "@/server/db/queries/spells";
import { SpellFilters } from "./spell-filters";

/**
 * The rail's contract with the reader.
 *
 * Three rules hold it together, and all three are invisible in the markup
 * unless something asserts them:
 *
 *  - the option list never changes length, so the rail does not rearrange
 *    under the cursor as filters are applied;
 *  - an option that would return nothing stops being a link, rather than
 *    staying a focusable anchor that leads to an empty table;
 *  - a selected option stays a link, because clicking it is how you clear it.
 *
 * The second and third pull in opposite directions, which is exactly why they
 * are worth pinning: a selected option can also have a zero count.
 *
 * URL construction is `query-params.test.ts`'s job. What is checked here is
 * that the rail wires the right helper to the right key.
 */

const option = <T extends string | number>(
  value: T,
  over: Partial<FacetOption<T>> = {},
): FacetOption<T> => ({
  value,
  count: 10,
  selected: false,
  disabled: false,
  ...over,
});

const facets = (over: Partial<SpellFacetOptions> = {}): SpellFacetOptions => ({
  levels: [option(0), option(1), option(2)],
  schools: [option("A"), option("V"), option("N")],
  castingTimes: [option("action"), option("bonus")],
  classes: [option("Wizard"), option("Cleric")],
  concentration: option("conc"),
  ritual: option("ritual"),
  ...over,
});

/** Every option in the rail, link or not. */
const options = (container: HTMLElement) =>
  [...container.querySelectorAll("a[href], span[aria-disabled]")].filter(
    (el) => !el.textContent?.includes("Clear filters"),
  );

describe("the spell filter rail", () => {
  it("shows every option in the facet domain", () => {
    const { container } = render(
      <SpellFilters params={{}} facets={facets()} />,
    );

    // 3 levels + 3 schools + 2 times + 2 classes + concentration + ritual.
    expect(options(container)).toHaveLength(12);
  });

  it("names each group", () => {
    render(<SpellFilters params={{}} facets={facets()} />);

    for (const label of [
      "Level",
      "School",
      "Casting time",
      "Class",
      "Requires",
    ]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
  });

  it("spells out codes the reader would not recognise", () => {
    render(<SpellFilters params={{}} facets={facets()} />);

    expect(screen.getByText("Cantrip")).toBeInTheDocument();
    expect(screen.getByText("Abjuration")).toBeInTheDocument();
    expect(screen.getByText("Bonus action")).toBeInTheDocument();
  });

  it("shows the count beside each option", () => {
    render(
      <SpellFilters
        params={{}}
        facets={facets({ levels: [option(0, { count: 42 })] })}
      />,
    );

    const cantrip = screen.getByText("Cantrip").closest("a")!;
    expect(within(cantrip).getByText("42")).toBeInTheDocument();
  });

  describe("with nothing filtered", () => {
    it("makes every option a link", () => {
      const { container } = render(
        <SpellFilters params={{}} facets={facets()} />,
      );

      for (const el of options(container)) {
        expect(el.tagName).toBe("A");
      }
    });

    it("offers no way to clear", () => {
      render(<SpellFilters params={{}} facets={facets()} />);

      expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
    });
  });

  describe("with a filter applied", () => {
    const filtered = facets({
      levels: [option(0, { selected: true }), option(1), option(2)],
      schools: [option("A"), option("V", { count: 0, disabled: true })],
    });

    it("keeps the option list the same length", () => {
      const { container } = render(
        <SpellFilters params={{ level: "0" }} facets={facets()} />,
      );
      const before = options(container).length;

      const after = render(
        <SpellFilters params={{ level: "0" }} facets={facets()} />,
      );
      expect(options(after.container)).toHaveLength(before);
    });

    /**
     * A dead anchor would still take focus and still promise a destination.
     * The count next to it already says the destination is empty.
     */
    it("turns an unavailable option into a non-focusable span", () => {
      render(<SpellFilters params={{ level: "0" }} facets={filtered} />);

      const evocation = screen
        .getByText("Evocation")
        .closest("a[href], span[aria-disabled]")!;

      expect(evocation.tagName).toBe("SPAN");
      expect(evocation).toHaveAttribute("aria-disabled", "true");
    });

    /** Clicking a selected option is how it gets cleared. */
    it("keeps a selected option a link, and marks it current", () => {
      render(<SpellFilters params={{ level: "0" }} facets={filtered} />);

      const cantrip = screen.getByText("Cantrip").closest("a")!;
      expect(cantrip).toHaveAttribute("aria-current", "true");
    });

    it("offers a way to clear", () => {
      render(<SpellFilters params={{ level: "0" }} facets={filtered} />);

      expect(screen.getByText("Clear filters")).toBeInTheDocument();
    });
  });

  describe("option links", () => {
    it("toggles its own value into the URL", () => {
      render(<SpellFilters params={{}} facets={facets()} />);

      expect(screen.getByText("Cantrip").closest("a")).toHaveAttribute(
        "href",
        "/compendium/spells?level=0",
      );
      expect(screen.getByText("Wizard").closest("a")).toHaveAttribute(
        "href",
        "/compendium/spells?class=Wizard",
      );
    });

    it("toggles its own value back out again", () => {
      render(<SpellFilters params={{ level: "0" }} facets={facets()} />);

      expect(screen.getByText("Cantrip").closest("a")).toHaveAttribute(
        "href",
        "/compendium/spells",
      );
    });

    /** Sort is a view preference, not a filter, so clearing must not drop it. */
    it("keeps the sort when clearing the filters", () => {
      render(
        <SpellFilters
          params={{ level: "0", sort: "level" }}
          facets={facets()}
        />,
      );

      expect(screen.getByText("Clear filters").closest("a")).toHaveAttribute(
        "href",
        "/compendium/spells?sort=level",
      );
    });
  });
});
