"use client";

import { Box, Stack, Skeleton } from "@chakra-ui/react";
import { BrowseAside } from "@/components/layout";
import { useAside } from "./aside-context";

/**
 * The aside itself: shell, close control, and whatever the server sent back.
 *
 * Mounted as soon as a row is clicked rather than when the reply lands, so the
 * frame reacts at once — the rail collapses and the table sheds columns off the
 * click, and the body fills in underneath. Waiting for the response would make
 * every open look like a stall.
 */
export function AsideSlot() {
  const { openKey, node, close } = useAside();

  if (!openKey) return null;

  return (
    <BrowseAside>
      <Box
        asChild
        position="sticky"
        top="0"
        zIndex="1"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        w="100%"
        textAlign="left"
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
        _hover={{ color: "brand" }}
      >
        <button type="button" onClick={close}>
          <span>Close</span>
          <span aria-hidden="true">✕</span>
        </button>
      </Box>

      {node ?? <AsidePlaceholder />}
    </BrowseAside>
  );
}

/**
 * Stands in for the body while it loads. Shaped like a spell — a source line, a
 * title, the stat lines, then prose — so the panel does not resize under the
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
