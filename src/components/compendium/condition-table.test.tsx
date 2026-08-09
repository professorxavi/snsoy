import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, within } from "@/test/render";
import type { ConditionRow } from "@/server/db/queries/conditions";
import { AsideProvider } from "./aside-context";
import { ConditionTable } from "./condition-table";

/**
 * The condition list, given rows.
 *
 * Ordering is the database's and the effect lines are covered where they live.
 * What is asserted here is what only the table can get wrong: the row opens the
 * condition rather than navigating to a page that does not exist, and the
 * effect column survives the aside while the source column does not.
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

const row = (over: Partial<ConditionRow> = {}): ConditionRow => ({
  id: "00000000-0000-0000-0000-000000000001",
  name: "Grappled",
  slug: "grappled",
  sourceId: "PHB",
  ...over,
});

const bodyRows = () =>
  [...document.querySelectorAll("tbody tr")] as HTMLElement[];

describe("the condition table", () => {
  it("renders a row per condition", () => {
    renderTable(
      <ConditionTable
        rows={[row(), row({ id: "2", name: "Prone", slug: "prone" })]}
        open={stubOpen()}
      />,
    );

    expect(bodyRows()).toHaveLength(2);
  });

  it("gives a row exactly one link, addressing the condition", () => {
    renderTable(<ConditionTable rows={[row()]} open={stubOpen()} />);

    const links = within(bodyRows()[0]!).getAllByRole("link");

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      "/compendium/conditions/phb/grappled",
    );
    expect(links[0]).toHaveTextContent("Grappled");
  });

  it("says on the row what the condition does", () => {
    renderTable(<ConditionTable rows={[row()]} open={stubOpen()} />);

    expect(
      within(bodyRows()[0]!).getByText("Speed becomes 0 until the grapple ends."),
    ).toBeInTheDocument();
  });

  /**
   * The deliberate difference from the skill table. Only the source drops out
   * when the aside opens: the effect line is the one thing on the row worth
   * reading, and someone working through the conditions should still see what
   * the next one does while the last is open.
   */
  it("keeps the effect column when the aside opens, and drops the source", () => {
    renderTable(<ConditionTable rows={[row()]} open={stubOpen()} />);

    const optional = [
      ...document.querySelectorAll("thead [data-col-optional]"),
    ].map((cell) => cell.textContent);

    expect(optional).toEqual(["Source"]);
  });

  /**
   * A condition has no page, so this is not a preference — following the link
   * is a 404. The anchor still carries the canonical URL, which is what makes
   * "copy link address" meaningful, so the only thing standing between a click
   * and a dead end is the handler cancelling it.
   */
  it("opens the condition instead of following the link", async () => {
    const open = stubOpen();
    renderTable(<ConditionTable rows={[row()]} open={open} />);

    const link = within(bodyRows()[0]!).getByRole("link");
    const event = await clickAndCapture(link);

    expect(open).toHaveBeenCalledWith("PHB", "grappled");
    expect(event.defaultPrevented).toBe(true);
  });

  it("says so when there is nothing to list, rather than showing an empty table", () => {
    renderTable(<ConditionTable rows={[]} open={stubOpen()} />);

    expect(screen.getByText(/No conditions to show/i)).toBeInTheDocument();
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
