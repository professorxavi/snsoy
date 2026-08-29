import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import { SubraceList } from "./subrace-accordion";

/**
 * The subrace disclosures.
 *
 * Two decisions here are load-bearing and neither is visible in a diff:
 *
 *  - the body is rendered into the document even while collapsed, so a
 *    Tiefling's twelve subraces are all in the HTML, findable with the
 *    browser's own find-in-page and readable without JavaScript;
 *  - the anchor sits *inside* the disclosure rather than on it, because
 *    browsers expand a closed `<details>` when the fragment targets its
 *    contents and do nothing at all when it targets the element itself.
 *
 * The second one is why ~93 inbound subrace links work. Move the `id` up onto
 * the `<details>` and every one of them silently lands on a collapsed section.
 * Nothing about the rendered page would look wrong.
 *
 * A third is why `listKey` exists at all — see "two subraces that share a slug".
 */

const ITEMS = [
  {
    id: "hill",
    listKey: "subrace|hill|dwarf|phb|phb",
    name: "Hill",
    meta: "PHB",
    body: <p>Hill dwarf traits.</p>,
  },
  {
    id: "mountain",
    listKey: "subrace|mountain|dwarf|phb|phb",
    name: "Mountain",
    body: <p>Mountain dwarf traits.</p>,
  },
  {
    id: "duergar",
    listKey: "subrace|duergar|dwarf|phb|scag",
    name: "Duergar",
    body: <p>Duergar traits.</p>,
  },
];

const disclosures = () =>
  [...document.querySelectorAll("details")] as HTMLDetailsElement[];

describe("the subrace list", () => {
  it("renders one disclosure per subrace", () => {
    render(<SubraceList items={ITEMS} />);

    expect(disclosures()).toHaveLength(3);
  });

  it("renders nothing at all when a race has no subraces", () => {
    const { container } = render(<SubraceList items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("arrives collapsed", () => {
    render(<SubraceList items={ITEMS} />);

    expect(disclosures().every((el) => !el.open)).toBe(true);
  });

  it("keeps every name readable while collapsed", () => {
    render(<SubraceList items={ITEMS} />);

    for (const item of ITEMS) {
      expect(screen.getByText(item.name)).toBeInTheDocument();
    }
  });

  /**
   * Server-rendered, not lazy. A collapsed `<details>` still holds its content,
   * which is what makes find-in-page and no-JavaScript reading work.
   */
  it("puts the body in the document before anything is opened", () => {
    render(<SubraceList items={ITEMS} />);

    expect(screen.getByText("Hill dwarf traits.")).toBeInTheDocument();
    expect(screen.getByText("Duergar traits.")).toBeInTheDocument();
    expect(disclosures().every((el) => !el.open)).toBe(true);
  });

  /**
   * PHB Elf has two subraces named Eladrin — one printed in the DMG, one in
   * Mordenkainen's — and both slug to `eladrin`. It is the only such pair among
   * all the subraces, and it is enough to make React drop one of the two if the
   * slug is what the list is keyed by.
   *
   * The count alone would not catch it: a duplicate key is a console warning
   * rather than a throw, and React still renders both rows here. So the warning
   * is what is asserted, and the natural key is what stops it.
   */
  describe("two subraces that share a slug", () => {
    const ELADRIN = [
      {
        id: "eladrin",
        listKey: "subrace|eladrin|elf|phb|dmg",
        name: "Eladrin",
        meta: "Dungeon Master's Guide",
        body: <p>Eladrin traits, as the DMG prints them.</p>,
      },
      {
        id: "eladrin",
        listKey: "subrace|eladrin|elf|phb|mtf",
        name: "Eladrin",
        meta: "Mordenkainen's Tome of Foes",
        body: <p>Eladrin traits, as MTF prints them.</p>,
      },
    ];

    let warnings: unknown[][];

    beforeEach(() => {
      warnings = [];
      vi.spyOn(console, "error").mockImplementation((...args) => {
        warnings.push(args);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("lists both, each with its own body", () => {
      render(<SubraceList items={ELADRIN} />);

      expect(disclosures()).toHaveLength(2);
      expect(
        screen.getByText("Eladrin traits, as the DMG prints them."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Eladrin traits, as MTF prints them."),
      ).toBeInTheDocument();
    });

    it("keys them apart, so React does not treat them as one row", () => {
      render(<SubraceList items={ELADRIN} />);

      expect(
        warnings.filter(([message]) => String(message).includes("same key")),
      ).toEqual([]);
    });
  });

  describe("the anchor a deep link targets", () => {
    /**
     * Inside the disclosure, never on it. A fragment pointing at a `<details>`
     * itself leaves it shut; one pointing at a descendant opens it.
     */
    it("sits inside the disclosure, not on it", () => {
      render(<SubraceList items={ITEMS} />);

      const anchor = document.getElementById("hill")!;
      const details = anchor.closest("details")!;

      expect(anchor).toBeInTheDocument();
      expect(details).not.toBe(anchor);
      expect(details.id).toBe("");
      expect(details.contains(anchor)).toBe(true);
    });

    it("wraps the body, so the target is what the reader came for", () => {
      render(<SubraceList items={ITEMS} />);

      expect(
        within(document.getElementById("hill")!).getByText("Hill dwarf traits."),
      ).toBeInTheDocument();
    });

    it("gives every subrace its own anchor", () => {
      render(<SubraceList items={ITEMS} />);

      for (const item of ITEMS) {
        expect(document.getElementById(item.id)).toBeInTheDocument();
      }
    });

    /**
     * Without this the anchor lands beneath the sticky top bar and the reader
     * arrives looking at the middle of the section they jumped to. Read off
     * the computed style rather than `style`, since Chakra's props become an
     * emotion class rather than an inline declaration.
     */
    it("leaves room for the sticky header when scrolled to", () => {
      render(<SubraceList items={ITEMS} />);

      const offset = getComputedStyle(
        document.getElementById("hill")!,
      ).scrollMarginTop;

      expect(offset).not.toBe("");
      expect(parseFloat(offset)).toBeGreaterThan(0);
    });
  });

  describe("the summary", () => {
    it("is the clickable control, one per disclosure", () => {
      render(<SubraceList items={ITEMS} />);

      expect(document.querySelectorAll("summary")).toHaveLength(3);
      for (const details of disclosures()) {
        expect(details.querySelector("summary")).not.toBeNull();
      }
    });

    it("shows the meta when there is some, and copes without", () => {
      render(<SubraceList items={ITEMS} />);

      const [hill, mountain] = disclosures();

      expect(within(hill!).getByText("PHB")).toBeInTheDocument();
      expect(within(mountain!).queryByText("PHB")).not.toBeInTheDocument();
    });

    /**
     * The default marker is suppressed in CSS and replaced with a drawn
     * chevron, because the obvious character for it renders as a blue emoji
     * that ignores `color`.
     */
    it("carries a chevron that is hidden from assistive technology", () => {
      render(<SubraceList items={ITEMS} />);

      const chevron = disclosures()[0]!.querySelector("[data-chevron]")!;

      expect(chevron.tagName.toLowerCase()).toBe("svg");
      expect(chevron).toHaveAttribute("aria-hidden", "true");
    });
  });
});
