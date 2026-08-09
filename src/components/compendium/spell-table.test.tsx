import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, within } from "@/test/render";
import type { SpellRow } from "@/server/db/queries/spells";
import { AsideProvider } from "./aside-context";
import { SpellTable } from "./spell-table";

/**
 * The comparison table, given rows.
 *
 * Two things here are easy to break and impossible to see in a diff: the row
 * carries exactly one link rather than one per cell, and the columns that drop
 * out when the aside opens are the ones marked to. The rest is formatting,
 * covered where the formatters live — what is asserted below is that the table
 * reaches for the right one.
 */

/**
 * Stands in for `openSpellAside`. The real one is a server function whose
 * module opens a database connection at import time, which has no place in a
 * jsdom test — which is why the table takes it as a prop rather than importing
 * it.
 */
const stubOpen = () => vi.fn(async () => null);

/** A row can only reach the aside from inside its provider. */
const renderTable = (ui: ReactElement) =>
  render(<AsideProvider>{ui}</AsideProvider>);

const row = (over: Partial<SpellRow> = {}): SpellRow =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    name: "Fireball",
    slug: "fireball",
    sourceId: "PHB",
    level: 3,
    school: "V",
    isConcentration: false,
    isRitual: false,
    classes: ["Wizard", "Sorcerer"],
    time: [{ number: 1, unit: "action" }],
    range: { type: "point", distance: { type: "feet", amount: 150 } },
    components: { v: true, s: true, m: "a tiny ball of bat guano" },
    duration: [{ type: "instant" }],
    ...over,
  }) as SpellRow;

const bodyRows = () =>
  [...document.querySelectorAll("tbody tr")] as HTMLElement[];

describe("the spell table", () => {
  it("renders a row per spell", () => {
    renderTable(
      <SpellTable
        rows={[row(), row({ id: "2", name: "Light", slug: "light" })]}
        params={{}}
        open={stubOpen()}
      />,
    );

    expect(bodyRows()).toHaveLength(2);
  });

  /**
   * Nine identical links per row is unusable with a keyboard or a screen
   * reader, so the whole row is one anchor stretched by a pseudo-element.
   */
  it("gives a row exactly one link, pointing at the spell", () => {
    renderTable(<SpellTable rows={[row()]} params={{}} open={stubOpen()} />);

    const links = within(bodyRows()[0]!).getAllByRole("link");

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      "/compendium/spells/phb/fireball",
    );
    expect(links[0]).toHaveTextContent("Fireball");
  });

  describe("the level column", () => {
    it("writes a cantrip as C rather than 0", () => {
      renderTable(
        <SpellTable rows={[row({ level: 0 })]} params={{}} open={stubOpen()} />,
      );

      expect(within(bodyRows()[0]!).getByText("C")).toBeInTheDocument();
    });

    it("writes every other level as its number", () => {
      renderTable(
        <SpellTable rows={[row({ level: 9 })]} params={{}} open={stubOpen()} />,
      );

      expect(within(bodyRows()[0]!).getByText("9")).toBeInTheDocument();
    });
  });

  describe("markers beside the name", () => {
    it("flags concentration and ritual, spelled out for a reader", () => {
      renderTable(
        <SpellTable
          rows={[row({ isConcentration: true, isRitual: true })]}
          params={{}}
          open={stubOpen()}
        />,
      );

      const cell = bodyRows()[0]!;
      expect(within(cell).getByTitle("Concentration")).toHaveTextContent("C");
      expect(within(cell).getByTitle("Ritual")).toHaveTextContent("R");
    });

    it("leaves them off a spell that needs neither", () => {
      renderTable(<SpellTable rows={[row()]} params={{}} open={stubOpen()} />);

      expect(screen.queryByTitle("Concentration")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Ritual")).not.toBeInTheDocument();
    });

    /**
     * A cantrip that needs concentration shows C twice, for two different
     * reasons. Only the marker carries a title, which is what tells them apart.
     */
    it("does not confuse a cantrip's C with a concentration C", () => {
      renderTable(
        <SpellTable
          rows={[row({ level: 0, isConcentration: true })]}
          params={{}}
          open={stubOpen()}
        />,
      );

      const cell = bodyRows()[0]!;
      expect(within(cell).getAllByText("C")).toHaveLength(2);
      expect(within(cell).getAllByTitle("Concentration")).toHaveLength(1);
    });
  });

  describe("sorting", () => {
    it("marks the sorted column and offers the other", () => {
      renderTable(
        <SpellTable
          rows={[row()]}
          params={{ sort: "level" }}
          open={stubOpen()}
        />,
      );

      const lvl = screen.getByRole("columnheader", { name: /Lvl/ });
      const name = screen.getByRole("columnheader", { name: /Name/ });

      expect(lvl).toHaveAttribute("aria-sort", "ascending");
      expect(name).not.toHaveAttribute("aria-sort");
    });

    /** No `sort` in the URL means name order, so Name is the marked column. */
    it("treats name as the default", () => {
      renderTable(<SpellTable rows={[row()]} params={{}} open={stubOpen()} />);

      expect(
        screen.getByRole("columnheader", { name: /Name/ }),
      ).toHaveAttribute("aria-sort", "ascending");
    });

    it("links each sortable header to its own sort, keeping the filters", () => {
      renderTable(
        <SpellTable
          rows={[row()]}
          params={{ level: "3" }}
          open={stubOpen()}
        />,
      );

      expect(
        within(screen.getByRole("columnheader", { name: /Lvl/ })).getByRole(
          "link",
        ),
      ).toHaveAttribute("href", "/compendium/spells?level=3&sort=level");
    });
  });

  /**
   * The browse frame hides these with CSS when the aside opens. The CSS is a
   * browser's problem; that the right columns are marked is this table's.
   */
  it("marks the columns that drop out when the aside opens", () => {
    renderTable(<SpellTable rows={[row()]} params={{}} open={stubOpen()} />);

    const optional = [
      ...document.querySelectorAll("thead [data-col-optional]"),
    ].map((cell) => cell.textContent);

    expect(optional).toEqual(["Components", "Duration", "Classes"]);
  });

  describe("opening a spell", () => {
    /**
     * The click must not navigate. The row's anchor still points at the spell's
     * own page — that is what makes ⌘-click and "copy link address" work — so
     * the only thing standing between a click and a full page load is the
     * handler cancelling it.
     */
    it("loads the spell instead of following the link", async () => {
      const open = stubOpen();
      renderTable(<SpellTable rows={[row()]} params={{}} open={open} />);

      const link = within(bodyRows()[0]!).getByRole("link");
      const event = await clickAndCapture(link);

      expect(open).toHaveBeenCalledWith("PHB", "fireball");
      expect(event.defaultPrevented).toBe(true);
    });

    /**
     * The frame tints the open row through a `:has()` rule keyed on this
     * attribute, so its absence on the others is half the assertion.
     */
    it("marks only the open spell's link as current", async () => {
      renderTable(
        <SpellTable
          rows={[row(), row({ id: "2", name: "Light", slug: "light" })]}
          params={{}}
          open={stubOpen()}
        />,
      );

      const links = screen.getAllByRole("link", { name: /Fireball|Light/ });
      await userEvent.click(links[1]!);

      expect(links[0]).not.toHaveAttribute("aria-current");
      expect(links[1]).toHaveAttribute("aria-current", "true");
    });
  });

  it("says so when nothing matched, rather than showing an empty table", () => {
    renderTable(<SpellTable rows={[]} params={{}} open={stubOpen()} />);

    expect(screen.getByText(/No spells match/i)).toBeInTheDocument();
    expect(document.querySelector("table")).toBeNull();
  });
});

/**
 * Clicks and hands back the event, so a test can ask whether the default was
 * cancelled. Testing Library's click does not surface the event itself.
 */
async function clickAndCapture(element: HTMLElement): Promise<MouseEvent> {
  let captured: MouseEvent | undefined;
  const listen = (event: Event) => {
    captured = event as MouseEvent;
  };

  document.addEventListener("click", listen);
  try {
    await userEvent.click(element);
  } finally {
    document.removeEventListener("click", listen);
  }

  if (!captured) throw new Error("no click event reached the document");
  return captured;
}
