"use client";

import { Box } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

/**
 * Closes the entity aside. Uses `router.back()` rather than pushing the list
 * URL, since the aside was opened by a navigation and back undoes it without
 * growing the history stack.
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
