import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, within } from "@/test/render";
import { AsideProvider } from "./aside-context";
import { GenericTable, type GenericColumn } from "./generic-table";

/**
 * The generic-entity list, given rows.
 *
 * Ordering is the database's and the cell contents belong to whichever page
 * supplied the column. What is asserted here is what only the table can get
 * wrong: the row opens the entity rather than navigating to a page that does
 * not exist, the URL is built for the type it was handed rather than a
 * hardcoded one, and a column marked optional is the only kind the aside sheds.
 */

/**
 * Stands in for the bound `openEntityAside`. The real one is a server function
 * whose module opens a database connection at import time, which is why the
 * table takes it as a prop rather than importing it.
 */
const stubOpen = () => vi.fn(async () => null);

/** A row can only reach the aside from inside its provider. */
const renderTable = (ui: ReactElement) =>
  render(<AsideProvider>{ui}</AsideProvider>);

interface Row {
  id: string;
  name: string;
  slug: string;
  sourceId: string;
  script: string | null;
}

const row = (over: Partial<Row> = {}): Row => ({
  id: "00000000-0000-0000-0000-000000000001",
  name: "Elvish",
  slug: "elvish",
  sourceId: "PHB",
  script: "Elvish",
  ...over,
});

const SCRIPT: GenericColumn<Row> = {
  label: "Script",
  cell: (r) => r.script,
  nowrap: true,
};

const bodyRows = () =>
  [...document.querySelectorAll("tbody tr")] as HTMLElement[];

describe("the generic entity table", () => {
  it("renders a row per entity", () => {
    renderTable(
      <GenericTable
        rows={[row(), row({ id: "2", name: "Dwarvish", slug: "dwarvish" })]}
        type="language"
        columns={[SCRIPT]}
        noun="languages"
        open={stubOpen()}
      />,
    );

    expect(bodyRows()).toHaveLength(2);
  });

  /**
   * The reason the type is a prop rather than baked in. Every table this
   * replaces hardcoded its own segment, and five more copies would have
   * hardcoded five more.
   */
  it("addresses the entity as the type it was given", () => {
    renderTable(
      <GenericTable
        rows={[row({ name: "Darkvision", slug: "darkvision" })]}
        type="sense"
        columns={[]}
        noun="senses"
        open={stubOpen()}
      />,
    );

    expect(within(bodyRows()[0]!).getByRole("link")).toHaveAttribute(
      "href",
      "/compendium/senses/phb/darkvision",
    );
  });

  it("gives a row exactly one link, whatever the column count", () => {
    renderTable(
      <GenericTable
        rows={[row()]}
        type="language"
        columns={[SCRIPT, { label: "Type", cell: () => "standard" }]}
        noun="languages"
        open={stubOpen()}
      />,
    );

    const links = within(bodyRows()[0]!).getAllByRole("link");

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Elvish");
  });

  it("prints each column through its own cell function", () => {
    renderTable(
      <GenericTable
        rows={[row()]}
        type="language"
        columns={[SCRIPT]}
        noun="languages"
        open={stubOpen()}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Script" })).toBeInTheDocument();
    expect(within(bodyRows()[0]!).getByText("Elvish", { selector: "td" }))
      .toBeInTheDocument();
  });

  /** The browse frame sheds any column marked this way when the aside opens. */
  it("marks only the optional columns, header and cell alike", () => {
    renderTable(
      <GenericTable
        rows={[row()]}
        type="language"
        columns={[SCRIPT, { label: "Speakers", cell: () => "Elves", optional: true }]}
        noun="languages"
        open={stubOpen()}
      />,
    );

    const marked = [...document.querySelectorAll("[data-col-optional]")];

    expect(marked).toHaveLength(2);
    expect(marked.map((cell) => cell.tagName)).toEqual(["TH", "TD"]);
  });

  /**
   * These types have no page, so this is not a preference — following the link
   * is a 404. The anchor still carries the canonical URL, which is what makes
   * "copy link address" meaningful, so the only thing standing between a click
   * and a dead end is the handler cancelling it.
   */
  it("opens the entity instead of following the link", async () => {
    const open = stubOpen();
    renderTable(
      <GenericTable
        rows={[row()]}
        type="language"
        columns={[]}
        noun="languages"
        open={open}
      />,
    );

    const link = within(bodyRows()[0]!).getByRole("link");
    const event = await clickAndCapture(link);

    expect(open).toHaveBeenCalledWith("PHB", "elvish");
    expect(event.defaultPrevented).toBe(true);
  });

  describe("with nothing to show", () => {
    const empty = (filtered?: boolean) =>
      renderTable(
        <GenericTable
          rows={[]}
          type="language"
          columns={[SCRIPT]}
          noun="languages"
          filtered={filtered}
          open={stubOpen()}
        />,
      );

    it("shows no table at all", () => {
      empty();

      expect(document.querySelector("table")).toBeNull();
    });

    /** Nothing narrowed it, so offering to widen a search would be nonsense. */
    it("blames the data when nothing was searched for", () => {
      empty();

      expect(screen.getByText("No languages to show.")).toBeInTheDocument();
    });

    it("blames the search when there was one", () => {
      empty(true);

      expect(
        screen.getByText("No languages match that search."),
      ).toBeInTheDocument();
    });
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
