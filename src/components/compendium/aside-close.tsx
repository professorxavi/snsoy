"use client";

import { Box } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

/**
 * Closing the entity aside.
 *
 * `router.back()` rather than a push to the list URL, because the aside was
 * opened by a navigation — going back is what actually undoes it, and it leaves
 * the history stack clean instead of growing an entry every time someone opens
 * and closes a spell.
 */
export function AsideClose() {
  const router = useRouter();

  return (
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
      <button type="button" onClick={() => router.back()}>
        <span>Close</span>
        <span aria-hidden="true">✕</span>
      </button>
    </Box>
  );
}
