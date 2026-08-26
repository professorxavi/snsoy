import { Box, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { DeadEndHint } from "./dead-end-hint";

export const metadata: Metadata = {
  title: "Not all roads lead somewhere",
};

/**
 * Where every 404 in the app arrives — both kinds.
 *
 * The dull kind is a typo or a stale bookmark. The kind worth building for is a
 * middle-click: most entities here have no page, but every one of them has an
 * address, because a citation in book text has to be a real anchor for the
 * panel to open in place. Open that anchor in a new tab and this is what you
 * get, through no fault of your own — so the page names what you were after and
 * points at where it does open. `DeadEndHint` is that half.
 *
 * It stays quiet for the four types that do have a page — see `hasDetailPage`.
 * A 404 there is a mistyped slug, and a confident explanation would be wrong.
 *
 * Reached without being routed to: Next renders it for unmatched URLs, and for
 * the `notFound()` calls in the book, chapter, spell, race, class and creature
 * pages.
 */
export default function NotFound() {
  return (
    <Box
      as="main"
      id="main"
      px={{ base: "5", md: "10" }}
      py={{ base: "16", md: "24" }}
      pb="24"
    >
      <Stack maxW="2xl" mx="auto" gap={{ base: "6", md: "8" }}>
        <Stack gap="4">
          <Text
            fontFamily="ui"
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="widest"
            textTransform="uppercase"
            color="fg.subtle"
          >
            404
          </Text>

          <Heading
            as="h1"
            fontFamily="display"
            fontWeight="normal"
            fontSize={{ base: "3xl", md: "5xl" }}
            lineHeight="1.0"
            letterSpacing="tight"
            textTransform="uppercase"
          >
            {/* The space before the break is load-bearing: without it the
                accessible name runs the two lines together. */}
            Not all roads{" "}
            <Box as="br" display={{ base: "none", md: "inline" }} />
            lead somewhere
          </Heading>

          <Text
            className="prose"
            fontFamily="body"
            fontSize="md"
            lineHeight="1.65"
            color="fg.muted"
            maxW="measure"
          >
            This one doesn&rsquo;t. Nothing in the books sits at that address.
          </Text>
        </Stack>

        <DeadEndHint />

        <HStack gap="6" pt="2">
          <WayOut href="/compendium">Compendium</WayOut>
          <WayOut href="/sources">Books</WayOut>
        </HStack>
      </Stack>
    </Box>
  );
}

function WayOut({ href, children }: { href: string; children: string }) {
  return (
    <Text
      asChild
      fontFamily="ui"
      fontSize="xs"
      fontWeight="medium"
      color="fg.muted"
      _hover={{ color: "fg", textDecoration: "underline" }}
    >
      <NextLink href={href}>{children}</NextLink>
    </Text>
  );
}
