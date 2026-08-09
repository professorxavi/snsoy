import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, within } from "@/test/render";
import type { SkillRow } from "@/server/db/queries/skills";
import { AsideProvider } from "./aside-context";
import { SkillTable } from "./skill-table";

/**
 * The skill list, given rows.
 *
 * Ordering is the database's and formatting is covered where the formatters
 * live. What is asserted here is what only the table can get wrong: the row
 * opens the skill rather than navigating to a page that does not exist, and the
 * columns that drop out when the aside opens are the ones marked to.
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

const row = (over: Partial<SkillRow> = {}): SkillRow => ({
  id: "00000000-0000-0000-0000-000000000001",
  name: "Perception",
  slug: "perception",
  sourceId: "PHB",
  ability: "wis",
  ...over,
});

const bodyRows = () =>
  [...document.querySelectorAll("tbody tr")] as HTMLElement[];

describe("the skill table", () => {
  it("renders a row per skill", () => {
    renderTable(
      <SkillTable
        rows={[row(), row({ id: "2", name: "Stealth", slug: "stealth" })]}
        params={{}}
        open={stubOpen()}
      />,
    );

    expect(bodyRows()).toHaveLength(2);
  });

  /** Four identical links per row is noise with a keyboard or a screen reader. */
  it("gives a row exactly one link, addressing the skill", () => {
    renderTable(<SkillTable rows={[row()]} params={{}} open={stubOpen()} />);

    const links = within(bodyRows()[0]!).getAllByRole("link");

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      "/compendium/skills/phb/perception",
    );
    expect(links[0]).toHaveTextContent("Perception");
  });

  it("spells the ability out rather than printing the data's code", () => {
    renderTable(<SkillTable rows={[row()]} params={{}} open={stubOpen()} />);

    const cells = within(bodyRows()[0]!);
    expect(cells.getByText("Wisdom")).toBeInTheDocument();
    expect(cells.queryByText("wis")).not.toBeInTheDocument();
  });

  it("summarises what the skill covers", () => {
    renderTable(<SkillTable rows={[row()]} params={{}} open={stubOpen()} />);

    expect(
      within(bodyRows()[0]!).getByText(/Spotting, hearing/),
    ).toBeInTheDocument();
  });

  describe("sorting", () => {
    /** No `sort` in the URL means name order, so Name is the marked column. */
    it("treats name as the default", () => {
      renderTable(<SkillTable rows={[row()]} params={{}} open={stubOpen()} />);

      expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute(
        "aria-sort",
        "ascending",
      );
    });

    it("marks the sorted column and offers the other", () => {
      renderTable(
        <SkillTable
          rows={[row()]}
          params={{ sort: "ability" }}
          open={stubOpen()}
        />,
      );

      expect(
        screen.getByRole("columnheader", { name: /Ability/ }),
      ).toHaveAttribute("aria-sort", "ascending");
      expect(
        screen.getByRole("columnheader", { name: /Name/ }),
      ).not.toHaveAttribute("aria-sort");
    });

    it("links each sortable header to its own order", () => {
      renderTable(<SkillTable rows={[row()]} params={{}} open={stubOpen()} />);

      expect(
        within(screen.getByRole("columnheader", { name: /Ability/ })).getByRole(
          "link",
        ),
      ).toHaveAttribute("href", "/compendium/skills?sort=ability");
    });
  });

  /**
   * The browse frame sheds any column marked this way when the aside opens.
   * This table marks none: three columns is the whole row, and a table that
   * shrank to a list of names would stop answering "which of these do I want"
   * at exactly the moment one is being read.
   */
  it("sheds no columns when the aside opens", () => {
    renderTable(<SkillTable rows={[row()]} params={{}} open={stubOpen()} />);

    expect(document.querySelectorAll("[data-col-optional]")).toHaveLength(0);
  });

  /** One book prints all eighteen, so a source column would say "PHB" and again. */
  it("names no source", () => {
    renderTable(<SkillTable rows={[row()]} params={{}} open={stubOpen()} />);

    expect(screen.queryByRole("columnheader", { name: /Source/ })).toBeNull();
    expect(screen.queryByText("PHB")).not.toBeInTheDocument();
  });

  /**
   * A skill has no page, so this is not a preference — following the link is a
   * 404. The anchor still carries the canonical URL, which is what makes
   * ⌘-click and "copy link address" meaningful, so the only thing standing
   * between a click and a dead end is the handler cancelling it.
   */
  it("opens the skill instead of following the link", async () => {
    const open = stubOpen();
    renderTable(<SkillTable rows={[row()]} params={{}} open={open} />);

    const link = within(bodyRows()[0]!).getByRole("link");
    const event = await clickAndCapture(link);

    expect(open).toHaveBeenCalledWith("PHB", "perception");
    expect(event.defaultPrevented).toBe(true);
  });

  it("says so when there is nothing to list, rather than showing an empty table", () => {
    renderTable(<SkillTable rows={[]} params={{}} open={stubOpen()} />);

    expect(screen.getByText(/No skills to show/i)).toBeInTheDocument();
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
