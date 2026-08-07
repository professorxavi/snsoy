"use client";

import { Box, Grid, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { BELOW_TOPBAR, TOPBAR } from "./constants";

/**
 * The compendium browse layout: filter rail, table, and the entity aside.
 *
 * The three regions are interdependent, which is the whole reason this is one
 * component rather than three. Opening an entity is what forces the rail to
 * collapse — at 1280px there is not room for a 212px rail, a table wide enough
 * to compare rows on, and a 400px aside at once, and the table is the part that
 * must not be squeezed.
 *
 * Below `lg` neither side region can hold its width: the rail moves behind a
 * trigger and the aside becomes a full-height sheet. That sheet is the one
 * place the aside pattern genuinely needs a second component.
 */
export function BrowseLayout({
  rail,
  aside,
  onCloseAside,
  children,
}: {
  rail?: ReactNode;
  /** The open entity. Absent means nothing is selected. */
  aside?: ReactNode;
  onCloseAside?: () => void;
  children: ReactNode;
}) {
  const asideOpen = Boolean(aside);

  return (
    <Grid
      templateColumns={{
        base: "1fr",
        lg: asideOpen
          ? "var(--chakra-sizes-rail-collapsed) minmax(0, 1fr) var(--chakra-sizes-aside)"
          : "var(--chakra-sizes-rail) minmax(0, 1fr)",
      }}
      alignItems="start"
    >
      {rail ? (
        <Box
          as="aside"
          aria-label="Filters"
          display={{ base: "none", lg: "block" }}
          position="sticky"
          top={TOPBAR}
          maxH={BELOW_TOPBAR}
          overflowY="auto"
          bg="bg.panel"
          borderRightWidth="1px"
          borderColor="border"
        >
          {asideOpen ? <CollapsedRail /> : rail}
        </Box>
      ) : null}

      <Box as="main" id="main" minW="0">
        {children}
      </Box>

      {asideOpen ? (
        <Box
          as="aside"
          aria-label="Entity detail"
          bg="bg.panel"
          borderLeftWidth={{ base: "0", lg: "1px" }}
          borderColor="border"
          /* Desktop: a sticky column scrolling independently of the list.
             Mobile: a sheet over it, since 400px is most of the viewport. */
          position={{ base: "fixed", lg: "sticky" }}
          top={TOPBAR}
          left={{ base: "0", lg: "auto" }}
          right={{ base: "0", lg: "auto" }}
          bottom={{ base: "0", lg: "auto" }}
          zIndex={{ base: "modal", lg: "auto" }}
          maxH={{ base: "none", lg: BELOW_TOPBAR }}
          overflowY="auto"
        >
          {onCloseAside ? (
            <Box
              asChild
              position="sticky"
              top="0"
              zIndex="1"
              display="block"
              w="100%"
              textAlign="left"
              bg="bg.panel"
              borderBottomWidth="1px"
              borderColor="border"
              px="4"
              py="2"
              fontSize="xs"
              color="fg.subtle"
              _hover={{ color: "brand" }}
            >
              <button type="button" onClick={onCloseAside}>
                Close
              </button>
            </Box>
          ) : null}
          {aside}
        </Box>
      ) : null}
    </Grid>
  );
}

/**
 * What the rail becomes while an entity is open. Not a real control yet —
 * Phase 5 owns the filters, and it will hang the reopen behaviour off this.
 */
function CollapsedRail() {
  return (
    <Box py="4" display="flex" flexDirection="column" alignItems="center" gap="3">
      <Text fontSize="md" color="brand" aria-hidden="true">
        &#9698;
      </Text>
      <Text
        fontSize="2xs"
        letterSpacing="widest"
        textTransform="uppercase"
        color="brand"
        fontWeight="semibold"
        css={{ writingMode: "vertical-rl" }}
      >
        Filters
      </Text>
    </Box>
  );
}
