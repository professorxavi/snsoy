import { describe, expect, it } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import {
  FILTER_RAIL_ID,
  FILTER_SHEET_ATTR,
  FilterSheetToggle,
} from "./filter-sheet";

/**
 * The mobile filter sheet.
 *
 * jsdom implements no layout and no media queries, so nothing here can see the
 * sheet *appear* — that is the browser test's job. What it can pin is the part
 * a refactor would quietly break: the attribute the stylesheet keys on. The
 * button and the rail never reference each other in JavaScript, so if this
 * attribute stops being written, or is written under another name, every list
 * silently loses its filters on a phone with `tsc`, eslint and the rest of the
 * suite still green.
 *
 * That name is also spelled out as a literal in `BrowseColumns` — Chakra's
 * static extraction leaves no choice, and the comment there explains why — so
 * the two can drift. This test holds one end of it; the browser test holds the
 * other, and is the only tier that can see them meet.
 *
 * The rail is stubbed rather than rendered: `FilterRail` is a server component
 * whose contribution here is the id, and the toggle finds it by that id or not
 * at all.
 */

function renderToggle() {
  return render(
    <>
      <div id={FILTER_RAIL_ID} tabIndex={-1} aria-label="Filters" />
      <FilterSheetToggle />
    </>,
  );
}

const button = () => screen.getByRole("button", { name: /Filters|Done/ });

describe("FilterSheetToggle", () => {
  it("starts closed, carrying nothing for the stylesheet to match", () => {
    renderToggle();

    expect(button()).not.toHaveAttribute(FILTER_SHEET_ATTR);
    expect(button()).toHaveAttribute("aria-expanded", "false");
    expect(button()).toHaveAttribute("aria-controls", FILTER_RAIL_ID);
  });

  it("opens on click and closes again on the same button", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(button());
    expect(button()).toHaveAttribute(FILTER_SHEET_ATTR);
    expect(button()).toHaveAttribute("aria-expanded", "true");

    await user.click(button());
    expect(button()).not.toHaveAttribute(FILTER_SHEET_ATTR);
  });

  it("moves focus into the rail, so the sheet is reachable by keyboard", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(button());

    expect(document.activeElement).toBe(document.getElementById(FILTER_RAIL_ID));
  });

  it("closes on Escape and hands focus back to the button", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(button());
    await user.keyboard("{Escape}");

    expect(button()).not.toHaveAttribute(FILTER_SHEET_ATTR);
    expect(document.activeElement).toBe(button());
  });

  it("closes when the page behind it is tapped", async () => {
    const user = userEvent.setup();
    const { container } = renderToggle();

    await user.click(button());

    // The backdrop is decoration with a click handler — it carries no role and
    // is hidden from assistive technology, so there is nothing to query it by.
    const backdrop = container.querySelector('div[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();

    await user.click(backdrop!);
    expect(button()).not.toHaveAttribute(FILTER_SHEET_ATTR);
  });
});
