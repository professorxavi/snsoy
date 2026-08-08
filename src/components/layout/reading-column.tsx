import { Box, Grid } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { BELOW_TOPBAR, TOPBAR } from "./constants";

/**
 * The long-form layout, for book and adventure chapters.
 *
 * No filter rail; instead an optional sticky outline on the trailing edge,
 * since chapters run long (555 KB at the extreme). The column width is measured
 * in `ch` so line length tracks the body face rather than a pixel guess.
 */
export function ReadingColumn({
  outline,
  outlineLabel = "On this page",
  children,
}: {
  outline?: ReactNode;
  /**
   * The outline's accessible name. The default suits every caller — this layout
   * serves races and classes as well as book chapters.
   */
  outlineLabel?: string;
  /**
   * Pass `undefined` for `outline` when there is nothing to list. A document
   * with no named sections has no outline, and the trailing column collapses
   * rather than printing a rule down an empty gutter.
   */
  children: ReactNode;
}) {
  return (
    <Grid
      templateColumns={{
        base: "1fr",
        lg: outline ? "minmax(0, 1fr) 13rem" : "minmax(0, 1fr)",
      }}
      justifyContent="center"
    >
      <Box as="main" id="main" minW="0" px={{ base: "5", md: "8" }} py="6" pb="20">
        <Box maxW="measure" mx={{ base: "0", lg: "auto" }}>
          {children}
        </Box>
      </Box>

      {outline ? (
        <Box
          as="nav"
          aria-label={outlineLabel}
          display={{ base: "none", lg: "block" }}
          position="sticky"
          top={TOPBAR}
          maxH={BELOW_TOPBAR}
          overflowY="auto"
          borderLeftWidth="1px"
          borderColor="border"
          px="3"
          py="5"
        >
          {outline}
        </Box>
      ) : null}
    </Grid>
  );
}
