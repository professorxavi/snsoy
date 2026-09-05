"use client";

import { Box, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";

/**
 * Where a failed render arrives.
 *
 * The counterpart to `not-found.tsx`, and deliberately quieter than it. A 404
 * is usually nobody's fault — a typo, a stale bookmark, a middle-clicked
 * citation — so that page can afford a turn of phrase. This one is our fault,
 * and being clever about our own failure reads badly to someone who came here
 * to look up a spell mid-session.
 *
 * A client component because Next requires it: an error boundary has to hold
 * state and hand back a `reset`, neither of which a server component can do.
 *
 * What it will actually fire on is a bad row reaching the entry renderer —
 * `book_sections` is 23 MB of JSON from an upstream project, and a shape nobody
 * anticipated throws inside a Server Component rather than rendering wrong.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
            Error
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
            Something broke
          </Heading>

          <Text
            className="prose"
            fontFamily="body"
            fontSize="md"
            lineHeight="1.65"
            color="fg.muted"
            maxW="measure"
            textWrap="pretty"
          >
            This page didn&rsquo;t load, and that&rsquo;s on us rather than on
            anything you did. Trying again sometimes works; the rest of the books
            are unaffected.
          </Text>
        </Stack>

        <HStack gap="3" pt="1">
          {/* `asChild` rather than `as="button"`, which is how the rest of the
              app reaches a real element: it keeps the button's own attributes
              on the button instead of forcing them through Chakra's props. */}
          <Box
            asChild
            fontFamily="ui"
            fontSize="xs"
            fontWeight="medium"
            px="4"
            py="2"
            rounded="l1"
            borderWidth="1px"
            borderColor="border"
            color="fg"
            cursor="pointer"
            _hover={{ bg: "bg.muted" }}
          >
            <button type="button" onClick={reset}>
              Try again
            </button>
          </Box>
        </HStack>

        <HStack gap="6" pt="2">
          <WayOut href="/compendium">Compendium</WayOut>
          <WayOut href="/sources">Books</WayOut>
        </HStack>

        {/*
          The digest, and never `error.message`. Next replaces the message with
          a generic string in production builds precisely because it is a server
          stack talking to a stranger; the digest is the hash that ties what the
          reader saw to a line in the server log, so it is the one thing worth
          showing and the only thing worth quoting in a report.
        */}
        {error.digest ? (
          <Text
            fontFamily="ui"
            fontSize="2xs"
            color="fg.subtle"
            letterSpacing="wide"
            pt="4"
          >
            Reference {error.digest}
          </Text>
        ) : null}
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
