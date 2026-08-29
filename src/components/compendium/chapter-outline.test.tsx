import { afterEach, describe, expect, it, vi } from "vitest";
import type { OutlineNode } from "@/lib/content/outline";
import { fireEvent, render, screen, waitFor, within } from "@/test/render";
import { ChapterOutline } from "./chapter-outline";

/** A heading, which is what `chapterOutline` produces for all but a run. */
function row(
  id: string,
  title: string,
  children: OutlineNode[] = [],
): OutlineNode {
  return { key: id, id, title, children };
}

/**
 * Shaped after the first chapter of Tomb of Annihilation, which is the case
 * this exists for: seven sections and ninety-nine headings under them.
 */
const ITEMS: OutlineNode[] = [
  row("arrival", "Arrival"),
  row("locations-in-the-city", "Locations in the City", [
    row("034", "Old City", [row("035", "1. Beggars' Palaces")]),
    row("038", "Merchants' Ward"),
  ]),
  row("city-denizens", "City Denizens", [row("055", "Volothamp Geddarm")]),
];

/** Every anchor, in the order the flattened outline visits them. */
const DEFAULT_IDS = [
  "arrival",
  "locations-in-the-city",
  "034",
  "035",
  "038",
  "city-denizens",
  "055",
];

const IDS = [...DEFAULT_IDS];

/**
 * The headings themselves, a screen apart.
 *
 * jsdom lays nothing out, so the scroll spy would measure every heading at zero
 * and call the last one current. Giving each a top is what lets the spy be
 * tested at all; without them it finds nothing and the outline stays on its
 * first section, which is what the tests that ignore scrolling want.
 */
function plantHeadings() {
  IDS.forEach((id, index) => {
    const heading = document.createElement("div");
    heading.id = id;
    heading.getBoundingClientRect = () => ({ top: index * 1000 }) as DOMRect;
    document.body.append(heading);
  });
}

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  fireEvent.scroll(window);
}

/** The disclosure a row belongs to, which is what carries its open state. */
function disclosure(name: string) {
  return screen.getByRole("link", { name }).closest("details");
}

afterEach(() => {
  document.querySelectorAll("body > div[id]").forEach((el) => el.remove());
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  history.replaceState(null, "", " ");
  IDS.splice(0, IDS.length, ...DEFAULT_IDS);
});

describe("ChapterOutline", () => {
  it("lists every level of the chapter", () => {
    render(<ChapterOutline items={ITEMS} />);

    expect(screen.getByRole("link", { name: "Old City" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "1. Beggars' Palaces" }),
    ).toBeInTheDocument();
  });

  /** A reader at the top of the page is in the first section. */
  it("opens the first section on arrival and leaves the rest closed", () => {
    render(<ChapterOutline items={ITEMS} />);

    expect(disclosure("Locations in the City")).not.toHaveAttribute("open");
    expect(disclosure("Old City")).not.toHaveAttribute("open");
  });

  it("links each row to its own anchor", () => {
    render(<ChapterOutline items={ITEMS} />);

    expect(screen.getByRole("link", { name: "Arrival" })).toHaveAttribute(
      "href",
      "#arrival",
    );
    expect(
      screen.getByRole("link", { name: "1. Beggars' Palaces" }),
    ).toHaveAttribute("href", "#035");
  });

  it("opens the branch being read and folds the one left behind", async () => {
    plantHeadings();
    render(<ChapterOutline items={ITEMS} />);

    // Into "Old City", inside "Locations in the City".
    scrollTo(2100);
    await waitFor(() =>
      expect(disclosure("Locations in the City")).toHaveAttribute("open"),
    );
    expect(disclosure("Old City")).toHaveAttribute("open");

    // On to "City Denizens", which is a different branch entirely.
    scrollTo(5100);
    await waitFor(() =>
      expect(disclosure("City Denizens")).toHaveAttribute("open"),
    );
    expect(disclosure("Locations in the City")).not.toHaveAttribute("open");
  });

  it("marks the row being read", async () => {
    plantHeadings();
    render(<ChapterOutline items={ITEMS} />);

    scrollTo(3100);
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "1. Beggars' Palaces" }),
      ).toHaveAttribute("aria-current", "location"),
    );
  });

  /**
   * The two intents are separate controls on purpose: clicking the name of the
   * section you are already reading must not fold it away.
   */
  it("reveals a closed section from its chevron without going there", () => {
    plantHeadings();
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<ChapterOutline items={ITEMS} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show sections in Locations in the City",
      }),
    );

    expect(disclosure("Locations in the City")).toHaveAttribute("open");
    // `nearest` is the outline keeping its own row in the gutter; going to a
    // section is `start`.
    expect(scrolled).not.toHaveBeenCalledWith({ block: "start" });
    expect(window.location.hash).toBe("");
    scrolled.mockRestore();
  });

  it("folds away the section being read when asked", async () => {
    plantHeadings();
    render(<ChapterOutline items={ITEMS} />);

    scrollTo(1100);
    await waitFor(() =>
      expect(disclosure("Locations in the City")).toHaveAttribute("open"),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Hide sections in Locations in the City",
      }),
    );

    expect(disclosure("Locations in the City")).not.toHaveAttribute("open");
  });

  /** Reading on past it is what puts the outline back in charge. */
  it("drops a hand-set disclosure once the reader moves on", async () => {
    plantHeadings();
    render(<ChapterOutline items={ITEMS} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show sections in Locations in the City",
      }),
    );
    expect(disclosure("Locations in the City")).toHaveAttribute("open");

    scrollTo(5100);
    await waitFor(() =>
      expect(disclosure("Locations in the City")).not.toHaveAttribute("open"),
    );
  });

  it("goes to a section when its name is clicked", () => {
    plantHeadings();
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<ChapterOutline items={ITEMS} />);

    fireEvent.click(screen.getByRole("link", { name: "City Denizens" }));

    expect(scrolled).toHaveBeenCalled();
    expect(window.location.hash).toBe("#city-denizens");
    expect(disclosure("City Denizens")).not.toHaveAttribute("open");
    scrolled.mockRestore();
  });

  it("renders nothing for a chapter with no sections", () => {
    const { container } = render(<ChapterOutline items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("names itself, so the gutter has a heading", () => {
    render(<ChapterOutline items={ITEMS} />);

    expect(screen.getByText("In this chapter")).toBeInTheDocument();
  });

  /**
   * A run of rows names a stretch of the list rather than a heading, so it has
   * nowhere to go and the whole row is the disclosure.
   */
  it("opens a run of rows from anywhere on it, and offers no link", () => {
    const gazetteer: OutlineNode[] = [
      {
        key: "locations~0",
        title: "Amphail – Daggerford",
        children: [row("179", "Amphail"), row("1a0", "Daggerford")],
      },
    ];
    render(<ChapterOutline items={gazetteer} />);

    expect(
      screen.queryByRole("link", { name: "Amphail – Daggerford" }),
    ).toBeNull();

    const run = screen.getByText("Amphail – Daggerford");
    expect(run.closest("details")).not.toHaveAttribute("open");

    fireEvent.click(run);
    expect(run.closest("details")).toHaveAttribute("open");
  });

  it("opens the run holding the heading being read", async () => {
    const gazetteer: OutlineNode[] = [
      row("peoples", "Peoples of the North"),
      row("locations", "Locations of the North", [
        {
          key: "locations~0",
          title: "Amphail – Daggerford",
          children: [row("179", "Amphail"), row("1a0", "Daggerford")],
        },
      ]),
    ];
    IDS.length = 0;
    IDS.push("peoples", "locations", "179", "1a0");
    plantHeadings();
    render(<ChapterOutline items={gazetteer} />);

    scrollTo(3100);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Daggerford" })).toHaveAttribute(
        "aria-current",
        "location",
      ),
    );
    expect(
      screen.getByText("Amphail – Daggerford").closest("details"),
    ).toHaveAttribute("open");
  });

  /** A section's children belong to it, not to the list above it. */
  it("nests a section's rows inside its own disclosure", () => {
    render(<ChapterOutline items={ITEMS} />);

    const locations = disclosure("Locations in the City");

    expect(
      within(locations as HTMLElement).getByRole("link", { name: "Old City" }),
    ).toBeInTheDocument();
    expect(
      within(locations as HTMLElement).queryByRole("link", {
        name: "Volothamp Geddarm",
      }),
    ).toBeNull();
  });
});
