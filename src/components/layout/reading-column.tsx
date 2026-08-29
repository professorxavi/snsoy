import { Box, Grid } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { BackToTop } from "./back-to-top";
import { BELOW_TOPBAR, OUTLINE, TOPBAR } from "./constants";
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
        lg: outline ? `minmax(0, 1fr) ${OUTLINE}` : "minmax(0, 1fr)",
      }}
      justifyContent="center"
    >
      <Box
        as="main"
        id="main"
        // Takes focus, so the skip link and `BackToTop` put the keyboard where
        // they put the page.
        tabIndex={-1}
        position="relative"
        minW="0"
        px={{ base: "5", md: "8" }}
        py="6"
        pb="20"
        /*
         * A size container, so a figure inside the measure can ask how wide the
         * column actually is. Nothing else here queries it; it exists so the
         * measure box below can publish the room going spare.
         */
        css={{ containerType: "inline-size" }}
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
          /*
           * How wide a figure may be here, published for the tables inside.
           *
           * Prose keeps the measure; a wide table is a figure and may use the
           * column's full width up to a cap. `cqi` reads the `main` above, so
           * the value can never reach past the column into the outline gutter,
           * and it collapses to the measure on a narrow screen where there is
           * no room going spare.
           *
           * Declared here rather than in the table because only the layout
           * knows this. Anywhere else — an aside, a stat block — the property
           * is simply undefined and a table stays exactly as wide as its
           * container, which is the behaviour to fall back to.
           */
          css={{ "--table-room": "min(72rem, 100cqi)" }}
        >
          {children}
        </Box>

        <FragmentTarget />
      </Box>

      {/*
        Fixed, so it takes no column here whatever the grid is doing. It belongs
        to this layout rather than to a page because every route that reads long
        enough to need it is one of these.
      */}
      <BackToTop clearsOutline={Boolean(outline)} />

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
