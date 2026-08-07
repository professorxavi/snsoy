import { Box, Grid } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { BELOW_TOPBAR, TOPBAR } from "./constants";

/**
 * The long-form layout, for book and adventure chapters.
 *
 * No filter rail — a chapter has nothing to filter. What it has instead is an
 * outline, because chapters run long (18.8 KB median, 555 KB at the extreme)
 * and losing your place in one is the failure mode this layout exists to
 * prevent. The outline is sticky and sits on the trailing edge so it never
 * comes between the reader and the text.
 *
 * The column is measured in `ch`, so the line length tracks Literata rather
 * than a pixel guess.
 */
export function ReadingColumn({
  outline,
  outlineLabel = "On this page",
  children,
}: {
  outline?: ReactNode;
  /**
   * The outline's accessible name. Defaults to something true everywhere —
   * this layout serves races and classes as well as book chapters, and "In this
   * chapter" is a lie on two of the three.
   */
  outlineLabel?: string;
  children: ReactNode;
}) {
  return (
    <Grid
      templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 13rem" }}
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
