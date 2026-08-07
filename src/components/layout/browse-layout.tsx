import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { BELOW_TOPBAR, TOPBAR } from "./constants";

/**
 * The compendium browse layout: filter rail, table, and the entity aside.
 *
 * The three regions are interdependent. Opening an entity is what forces the
 * rail to collapse — at 1280px there is not room for a 212px rail, a table wide
 * enough to compare rows on, and a 400px aside at once, and the table is the
 * part that must not be squeezed.
 *
 * **The aside is a route, not a prop.** It arrives as a parallel-route slot
 * filled by an intercepting route, so opening a spell changes the URL to that
 * spell's canonical address without unmounting the list. Back closes it, the
 * link is shareable, and a cold arrival on the same URL gets the full page. The
 * alternative — client state holding "which entity is open" — would give none
 * of that.
 *
 * That routing choice is why the frame and the rail communicate through CSS
 * rather than a shared flag: the two live in different subtrees (`layout.tsx`
 * owns the slot, the page owns the rail), and the *presence of a route* is the
 * only honest source of truth about whether anything is open. `:has()` reads it
 * directly, so there is no state to keep in sync and nothing to get wrong on a
 * back navigation.
 */

/** Marks the aside's content, so `:has()` can tell filled from empty. */
export const ASIDE_CONTENT_ATTR = "data-aside-content";

export function BrowseFrame({
  aside,
  children,
}: {
  /** The `@aside` slot. Renders empty when no entity is open. */
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      css={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        alignItems: "start",

        /* The rail's width, read by the page that owns the rail. */
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

        /* Which face the rail shows. Both are rendered; CSS picks one, so this
           needs no JavaScript and survives a back navigation intact. */
        "[data-rail-mini]": { display: "none" },
        [`&:has([${ASIDE_CONTENT_ATTR}]) [data-rail-full]`]: { display: "none" },
        [`&:has([${ASIDE_CONTENT_ATTR}]) [data-rail-mini]`]: { display: "block" },

        /* The table sheds its lowest-value columns to pay for the aside. */
        [`&:has([${ASIDE_CONTENT_ATTR}]) [data-col-optional]`]: {
          display: "none",
        },
      }}
    >
      <Box minW="0">{children}</Box>
      {aside}
    </Box>
  );
}

/**
 * The aside's own shell, rendered by the intercepting route.
 *
 * Desktop: a sticky column scrolling independently of the list, because a
 * monster statblock is roughly three times a spell's height and the two must
 * not drag each other. Mobile: a sheet over the list, since 400px is most of
 * the viewport — the one place this pattern genuinely needs a second shape.
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
      /* A fixed height, not a max: the aside is a panel, and a short spell
         should not leave it floating as a stub with the list showing beneath
         where the rest of it ought to be. */
      h={{ base: "auto", lg: BELOW_TOPBAR }}
      overflowY="auto"
    >
      {children}
    </Box>
  );
}

/**
 * The filter rail, owned by the page rather than the layout.
 *
 * It has to be: facet counts depend on the current filters, and filters live in
 * query params — which a layout never receives. So the page renders both faces
 * of the rail and the frame decides which is visible.
 */
export function FilterRail({
  children,
  collapsed,
}: {
  children: ReactNode;
  /** The icon strip shown once the aside takes the width. */
  collapsed: ReactNode;
}) {
  return (
    <Box
      as="aside"
      aria-label="Filters"
      display={{ base: "none", lg: "block" }}
      position="sticky"
      top={TOPBAR}
      /* Full height always, so the rail reads as a wall the list sits beside.
         Sized to the viewport rather than to its own options — otherwise the
         panel ends wherever the last filter happens to fall and the border
         stops mid-page. */
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

/** The two-column grid inside the main region: rail, then the list itself. */
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
