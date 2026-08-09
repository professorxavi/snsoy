"use client";

import { Box, Skeleton, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { AsideDrawer, BrowseAside } from "@/components/layout";
import type { BrowsableType } from "@/lib/routes";
import { useAside } from "./aside-context";
import { AsideLinks } from "./aside-links";

/**
 * The aside itself: shell, header, and whatever the server sent back.
 *
 * Mounted as soon as something is clicked rather than when the reply lands, so
 * the frame reacts at once — the rail collapses and the table sheds columns off
 * the click, and the body fills in underneath. Waiting for the response would
 * make every open look like a stall.
 */
export function AsideSlot({
  load,
  variant = "column",
}: {
  /**
   * Renders one entity, for references followed from inside the aside. Passed
   * in rather than imported because a client component may not import a server
   * function without breaking the client manifest in development.
   */
  load: (
    type: BrowsableType,
    source: string,
    slug: string,
  ) => Promise<ReactNode>;
  /**
   * `column` takes width from the browse list beside it; `drawer` floats over a
   * reading page, whose measured column must not rewrap while it is read.
   */
  variant?: "column" | "drawer";
}) {
  const { openKey, node, previous, back, close } = useAside();

  if (!openKey) return null;

  const Shell = variant === "drawer" ? AsideDrawer : BrowseAside;

  return (
    <Shell>
      <Box
        position="sticky"
        top="0"
        zIndex="1"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        gap="2"
        bg="bg.panel"
        borderBottomWidth="1px"
        borderColor="border"
        px="4"
        py="2"
        fontFamily="ui"
        fontSize="2xs"
        letterSpacing="wide"
        textTransform="uppercase"
        color="fg.subtle"
      >
        {/* Only once something has been opened from inside something else. */}
        {previous ? (
          <Box
            asChild
            minW="0"
            textAlign="left"
            truncate
            _hover={{ color: "brand" }}
          >
            <button type="button" onClick={back}>
              ← {previous.label ?? "Back"}
            </button>
          </Box>
        ) : (
          <span />
        )}

        <Box asChild flexShrink="0" _hover={{ color: "brand" }}>
          <button type="button" onClick={close}>
            <span>Close</span> <span aria-hidden="true">✕</span>
          </button>
        </Box>
      </Box>

      {/* Wrapped so a reference inside an open entity opens the next one over
          the top of it, rather than navigating away from the page beneath.
          `nested` is what makes those stack, so back comes here. */}
      <AsideLinks load={load} nested>
        {node ?? <AsidePlaceholder />}
      </AsideLinks>
    </Shell>
  );
}

/**
 * Stands in for the body while it loads. Shaped like an entity — a source line,
 * a title, some stat lines, then prose — so the panel does not resize under the
 * reader when the real thing arrives.
 */
function AsidePlaceholder() {
  return (
    <Stack gap="4" px="4" py="4" aria-hidden="true">
      <Stack gap="2">
        <Skeleton height="2" width="40%" />
        <Skeleton height="7" width="70%" />
        <Skeleton height="3" width="50%" />
      </Stack>
      <Stack gap="1.5">
        {[0, 1, 2, 3].map((line) => (
          <Skeleton key={line} height="3" width="60%" />
        ))}
      </Stack>
      <Stack gap="1.5">
        {[0, 1, 2, 3, 4].map((line) => (
          <Skeleton key={line} height="3" />
        ))}
      </Stack>
    </Stack>
  );
}
