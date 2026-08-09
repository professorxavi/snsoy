import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { BELOW_TOPBAR, TOPBAR } from "./constants";

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
 * The filter rail. Owned by the page, not the layout, because facet counts
 * depend on the current filters and a layout never receives `searchParams`.
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
    <Box
      as="aside"
      aria-label="Filters"
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
  );
}

/** Rail and list, side by side. */
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
      }}
    >
      {children}
    </Box>
  );
}
