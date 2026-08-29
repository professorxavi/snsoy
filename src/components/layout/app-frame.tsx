import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { AsideProvider } from "@/components/compendium/aside-context";
import { ImageViewer } from "@/components/entry/image-viewer";
import { TableScrollers } from "@/components/entry/table-scrollers";
import { TopNav } from "./top-nav";

/**
 * The outermost frame: skip link, top bar, and the route's own layout below.
 *
 * Does not render `<main>` — a filter rail is a sibling of the main region, not
 * part of it, so each layout owns its own. Every layout below must supply
 * `id="main"` for the skip link to land on.
 *
 * Owns the aside's state, but none of its presentation. The browse list and the
 * book reader want the same panel in different shapes — a column that takes
 * width, and a drawer that floats — so each layout renders its own slot and
 * they share what is open through this one provider.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <AsideProvider>
      <Box minH="100dvh" bg="bg">
        <Box
          asChild
          position="absolute"
          left="-9999px"
          top="2"
          zIndex="skipNav"
          px="3"
          py="2"
          bg="brand"
          color="brand.contrast"
          rounded="l1"
          fontSize="sm"
          _focusVisible={{ left: "2" }}
        >
          <a href="#main">Skip to content</a>
        </Box>
        <TopNav />
        {children}
        {/*
          One pass over every table on the page, wherever a layout put it.
          Mounted here rather than beside the tables because the point is that
          there is one of it: a chapter can carry 88 tables, and none of them
          needs an observer of its own to find out that it fits.
        */}
        <TableScrollers />
        {/*
          The window a printed map opens into. One of it, for the same reason as
          the scrollers above: the page may carry thirty images and needs one
          shared window, not thirty.
        */}
        <ImageViewer />
      </Box>
    </AsideProvider>
  );
}
