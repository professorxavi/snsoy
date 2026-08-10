"use client";

import { Box } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LuFilter, LuX } from "react-icons/lu";

/**
 * The filter rail's control below `lg`, where the rail itself is hidden.
 *
 * Every list in the compendium was unfilterable on a phone and on a tablet —
 * the rail is `display: none` under `lg` and nothing replaced it, so the only
 * way to narrow a list was to type in the search field.
 *
 * **This moves no filters into JavaScript.** The rail is server-rendered and
 * every option in it is a link, so the sheet needs no state beyond "is it
 * showing": it is the same DOM, in the same place, positioned differently. The
 * one boolean lives here and reaches the rail through the `:has()` rule in
 * `BrowseColumns`, which is how the rest of this layout already coordinates
 * across subtrees. Nothing is rendered twice, and nothing about the desktop
 * rail changes.
 *
 * Rendered by `FilterRail`, not by the toolbar, so the control cannot exist on
 * a page that has no rail to open — two of the five lists using `ListToolbar`
 * have no facets at all.
 */

/**
 * Marks the sheet as showing, for the `BrowseColumns` stylesheet to read. Both
 * sides need this name.
 *
 * Present or absent, never `"open"`/`"closed"`: Chakra's style engine mangles a
 * selector carrying a quoted attribute value — `:has([x="open"]) y` came out as
 * a bare ` y`, which matches everything the rule was meant to exclude and
 * nothing it was meant to include. The same reason `data-aside-content` is a
 * flag rather than a value.
 */
export const FILTER_SHEET_ATTR = "data-filter-sheet";

/** The rail's id, so the button can name what it opens in `aria-controls`. */
export const FILTER_RAIL_ID = "filter-rail";

/** Chakra's `lg`, where the rail becomes a column again. */
const LG = "(min-width: 64rem)";

export function FilterSheetToggle() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  /*
   * Only ever runs while open, which is what keeps it from stealing focus on
   * mount — the sheet is closed on first render, so the effect body has never
   * run by the time the page settles.
   */
  useEffect(() => {
    if (!open) return;

    // The rail is `display: none` until this render commits, and focus does
    // nothing to a hidden element — so it happens here rather than in the
    // click handler.
    document.getElementById(FILTER_RAIL_ID)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    /*
     * Widening the window past `lg` gives the rail its column back, and this
     * button — the only way to dismiss the sheet — is hidden at that width. So
     * the sheet closes with it, rather than being left open behind a control
     * that is no longer there. It is also what lets the sheet's rules in
     * `BrowseColumns` skip a media query: this is the breakpoint, held in one
     * place instead of asserted in two languages.
     */
    const wide = window.matchMedia(LG);
    const onWiden = () => {
      if (wide.matches) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    wide.addEventListener("change", onWiden);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      wide.removeEventListener("change", onWiden);
    };
  }, [open, close]);

  return (
    <>
      {open ? (
        <Box
          position="fixed"
          inset="0"
          display={{ base: "block", lg: "none" }}
          bg="blackAlpha.600"
          zIndex="overlay"
          onClick={close}
          aria-hidden="true"
        />
      ) : null}

      {/* Floats over the list rather than sitting in the toolbar: the sheet
          rises from the bottom edge and the thumb is already there, and it
          stays reachable as the control that closes it again. */}
      <Box
        asChild
        display={{ base: "inline-flex", lg: "none" }}
        alignItems="center"
        gap="2"
        position="fixed"
        bottom="5"
        insetInlineEnd="5"
        /* Above the sheet, which is `modal`, so it is never covered by it. */
        zIndex="popover"
        px="4"
        h="10"
        rounded="full"
        bg="brand"
        color="brand.contrast"
        fontFamily="ui"
        fontSize="xs"
        fontWeight="semibold"
        letterSpacing="wide"
        boxShadow="lg"
      >
        <button
          type="button"
          ref={buttonRef}
          onClick={() => (open ? close() : setOpen(true))}
          aria-expanded={open}
          aria-controls={FILTER_RAIL_ID}
          {...(open ? { [FILTER_SHEET_ATTR]: "" } : {})}
        >
          {open ? <LuX aria-hidden /> : <LuFilter aria-hidden />}
          {open ? "Done" : "Filters"}
        </button>
      </Box>
    </>
  );
}
