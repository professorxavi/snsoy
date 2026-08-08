import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { TopNav } from "./top-nav";

/**
 * The outermost frame: skip link, top bar, and the route's own layout below.
 *
 * Does not render `<main>` — a filter rail is a sibling of the main region, not
 * part of it, so each layout owns its own. Every layout below must supply
 * `id="main"` for the skip link to land on.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
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
    </Box>
  );
}
