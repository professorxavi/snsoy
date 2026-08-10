import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { BELOW_TOPBAR, TOPBAR } from "./constants";
import { FILTER_RAIL_ID, FilterSheetToggle } from "./filter-sheet";

/**
 * The compendium browse layout: filter rail, table, and the entity aside.
 *
 * The frame, the rail and the aside all live in different subtrees — the layout
 * owns the aside, the page owns the rail, the table owns its rows — so they
 * coordinate through CSS `:has()` rather than shared state. The frame reacts to
 * the aside's presence, and the aside's own link marks the open row; neither
 * needs a prop threaded through the tree to reach the other.
 */

/** Lets `:has()` tell a filled aside from an empty one. */
export const ASIDE_CONTENT_ATTR = "data-aside-content";


export function BrowseFrame({
  aside,
  children,
}: {
  /** The aside. Renders nothing when no entity is open. */
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      css={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        alignItems: "start",

        /* Read by the page that owns the rail. */
        "--rail-w": "var(--chakra-sizes-rail)",

        [`&:has([${ASIDE_CONTENT_ATTR}])`]: {
          "--rail-w": "var(--chakra-sizes-rail-collapsed)",
        },

        /* Below lg the aside is a sheet over the list, so the grid stays 1-up. */
        "@media (min-width: 62em)": {
          [`&:has([${ASIDE_CONTENT_ATTR}])`]: {
            gridTemplateColumns: "minmax(0, 1fr) var(--chakra-sizes-aside)",
          },
        },

        "& [data-rail-mini]": { display: "none" },
        [`&:has([${ASIDE_CONTENT_ATTR}]) [data-rail-full]`]: { display: "none" },
        [`&:has([${ASIDE_CONTENT_ATTR}]) [data-rail-mini]`]: { display: "block" },

        /* The table sheds its least important columns to pay for the aside. */
        [`&:has([${ASIDE_CONTENT_ATTR}]) [data-col-optional]`]: {
          display: "none",
        },

        /* The open row, marked by its own link rather than by a prop on the
           table — which is what keeps the table a server component. */
        '& tbody tr:has(a[aria-current="true"])': {
          background: "var(--chakra-colors-brand-subtle)",
        },
      }}
    >
      <Box minW="0">{children}</Box>
      {aside}
    </Box>
  );
}

/**
 * The aside's shell. A sticky column on desktop, scrolling independently of the
 * list; a full-height sheet on mobile, where 400px is most of the viewport.
 */
export function BrowseAside({ children }: { children: ReactNode }) {
  return (
    <Box
      as="aside"
      aria-label="Entity detail"
      {...{ [ASIDE_CONTENT_ATTR]: "" }}
      bg="bg.panel"
      borderLeftWidth={{ base: "0", lg: "1px" }}
      borderColor="border"
      position={{ base: "fixed", lg: "sticky" }}
      top={TOPBAR}
      left={{ base: "0", lg: "auto" }}
      right={{ base: "0", lg: "auto" }}
      bottom={{ base: "0", lg: "auto" }}
      zIndex={{ base: "modal", lg: "auto" }}
      /* Fixed height, not a max, so short content still fills the panel. */
      h={{ base: "auto", lg: BELOW_TOPBAR }}
      overflowY="auto"
    >
      {children}
    </Box>
  );
}

/**
 * The aside as an overlay, for the reading layouts.
 *
 * A chapter is a measured column of prose with an outline beside it and no
 * slack for a third column. Taking the width out of the text would rewrap the
 * paragraph being read every time something is opened, which is exactly the
 * interruption the aside exists to avoid — so here it floats over the page
 * instead and the text does not move at all.
 *
 * Carries the same `data-aside-content` attribute as `BrowseAside`, so anything
 * keyed on "something is open" needs to know only the one name.
 */
export function AsideDrawer({ children }: { children: ReactNode }) {
  return (
    <Box
      as="aside"
      aria-label="Entity detail"
      {...{ [ASIDE_CONTENT_ATTR]: "" }}
      position="fixed"
      top={{ base: "0", lg: TOPBAR }}
      bottom="0"
      right="0"
      left={{ base: "0", lg: "auto" }}
      w={{ base: "auto", lg: "aside" }}
      zIndex="modal"
      bg="bg.panel"
      borderLeftWidth={{ base: "0", lg: "1px" }}
      borderColor="border"
      boxShadow={{ base: "none", lg: "lg" }}
      overflowY="auto"
    >
      {children}
    </Box>
  );
}

/**
 * The filter rail. Owned by the page, not the layout, because facet counts
 * depend on the current filters and a layout never receives `searchParams`.
 *
 * Below `lg` the same element is the mobile filter sheet — see `FilterSheetToggle`,
 * which ships with the rail so the control cannot outlive it. The toggle is
 * `position: fixed`, so it is out of flow and the grid still sees one child here.
 */
export function FilterRail({
  children,
  collapsed,
}: {
  children: ReactNode;
  /** Shown once the aside takes the width. */
  collapsed: ReactNode;
}) {
  return (
    <>
      <Box
        as="aside"
        id={FILTER_RAIL_ID}
        /* Literal, for the reason `BrowseColumns` gives: a key built from an
           imported constant is dropped before it reaches the DOM. */
        {...{ "data-filter-rail": "" }}
        aria-label="Filters"
        /* Focusable only on purpose: opening the sheet moves focus here. */
        tabIndex={-1}
        display={{ base: "none", lg: "block" }}
        position="sticky"
        top={TOPBAR}
        /* Sized to the viewport, not its contents, so the border does not stop
           partway down the page. */
        h={BELOW_TOPBAR}
        overflowY="auto"
        bg="bg.panel"
        borderRightWidth="1px"
        borderColor="border"
      >
        <Box data-rail-full="">{children}</Box>
        <Box data-rail-mini="">{collapsed}</Box>
      </Box>

      <FilterSheetToggle />
    </>
  );
}

/**
 * Rail and list, side by side — and, below `lg`, the rail as a bottom sheet.
 *
 * The toggle is inside this subtree, so `:has()` can read its state from here
 * and restyle the rail without either of them holding a reference to the other.
 * The same way the frame above reacts to the aside.
 *
 * **The two attribute names below are spelled out rather than interpolated from
 * `FILTER_SHEET_ATTR` and `FILTER_RAIL_ATTR`, and they have to be.** Chakra's
 * Next.js integration extracts the `css` prop statically, and it resolves only
 * literals and constants declared in this same module — a key built from an
 * imported constant, or from a local inside the component, produces no rule at
 * all. It does not warn; the styles simply are not in the stylesheet, which
 * reads in the browser exactly like a `:has()` that never matched. Measured,
 * four ways, against a production build. Renaming either attribute means
 * changing it here too, and the browser test is what will catch it if not.
 */
export function BrowseColumns({ children }: { children: ReactNode }) {
  return (
    <Box
      css={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        alignItems: "start",
        "@media (min-width: 62em)": {
          gridTemplateColumns: "var(--rail-w) minmax(0, 1fr)",
        },

        /*
         * Below `lg` the rail is hidden, and these three rules are the only
         * thing that shows it: the sheet is the rail moved, not a copy of it.
         * Capped short of the full height so the list stays visible behind it
         * and it reads as a layer over the page rather than another screen.
         *
         * No media query guards them, because the sheet cannot be open above
         * `lg` — `FilterSheetToggle` closes itself at that width and says why.
         */
        "&:has([data-filter-sheet]) [data-filter-rail]": {
          display: "block",
          position: "fixed",
          insetInline: 0,
          top: "auto",
          bottom: 0,
          height: "auto",
          maxHeight: "70dvh",
          zIndex: "var(--chakra-z-index-modal)",
          borderTopWidth: "1px",
          borderTopLeftRadius: "var(--chakra-radii-l3)",
          borderTopRightRadius: "var(--chakra-radii-l3)",
          boxShadow: "var(--chakra-shadows-lg)",
        },

        /* The collapsed rail pays for the aside's width, which a sheet does not
           take — so the sheet carries the real thing even with an entity open. */
        "&:has([data-filter-sheet]) [data-filter-rail] [data-rail-full]": {
          display: "block",
        },
        "&:has([data-filter-sheet]) [data-filter-rail] [data-rail-mini]": {
          display: "none",
        },
      }}
    >
      {children}
    </Box>
  );
}
