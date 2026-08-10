import { Box, Grid } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { BELOW_TOPBAR, TOPBAR } from "./constants";
import { FragmentTarget } from "./fragment-target";

/**
 * The long-form layout, for book and adventure chapters.
 *
 * No filter rail; instead an optional sticky outline on the trailing edge,
 * since chapters run long (555 KB at the extreme). The column width is measured
 * in `ch` so line length tracks the body face rather than a pixel guess.
 *
 * Every route using this streams a fallback and every one of them is deep-linked
 * — subraces, subclasses, chapter sections — so `FragmentTarget` belongs here
 * rather than on any one page. It is rendered inside the streamed body on
 * purpose: that is what makes its effect run after the real content lands.
 */
export function ReadingColumn({
  outline,
  outlineLabel = "On this page",
  plate,
  plateSide = "right",
  children,
}: {
  outline?: ReactNode;
  /**
   * The outline's accessible name. The default suits every caller — this layout
   * serves races and classes as well as book chapters.
   */
  outlineLabel?: string;
  /**
   * Art for the top corner of the page, outside the reading measure entirely.
   *
   * Only the class pages pass one. It is placed rather than flowed — the whole
   * point is that the prose keeps its full width — so it sits behind the
   * content and takes no clicks. Everything else here leaves it unset and the
   * layout is exactly as it was.
   */
  plate?: ReactNode;
  /** Which corner it takes. The caller decides, from the art's own composition. */
  plateSide?: "left" | "right";
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
      <Box
        as="main"
        id="main"
        position="relative"
        minW="0"
        px={{ base: "5", md: "8" }}
        py="6"
        pb="20"
      >
        {plate ? (
          <Box
            position="absolute"
            top="0"
            left={plateSide === "left" ? "0" : "auto"}
            right={plateSide === "right" ? "0" : "auto"}
            /*
             * The margin going spare, plus a fixed reach over the column.
             *
             * Sized here rather than by the art because this is the element
             * that knows the page: the margin either side of the measure runs
             * from 80px at the narrowest width that has one to 370px at the
             * widest, while the overlap the art has to fade across should not
             * vary at all. Below `lg` there is no margin and no plate.
             */
            display={{ base: "none", lg: "block" }}
            w="clamp(11rem, calc((100% - {sizes.measure}) / 2 + 7rem), 30rem)"
            // Behind the text and inert: the art runs past the header and down
            // beside the opening paragraphs, and neither the reading nor the
            // selecting of them should notice it is there.
            zIndex="0"
            pointerEvents="none"
          >
            {plate}
          </Box>
        ) : null}

        <Box
          maxW="measure"
          mx={{ base: "0", lg: "auto" }}
          // Above the plate, so text is never printed under artwork.
          position="relative"
          zIndex="1"
        >
          {children}
        </Box>

        <FragmentTarget />
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
