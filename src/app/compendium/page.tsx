import { Box, Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import {
  DIRECTORY,
  isImplemented,
  type DirectoryEntry,
} from "@/lib/compendium-directory";
import { listHrefFor } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Compendium",
  description:
    "Spells, creatures, items and rules — cross-linked to everything that mentions them.",
};

/**
 * The compendium index.
 *
 * Five groups rather than one alphabetical list of 34. The types are wildly
 * unequal in how often anyone reaches for them — spells and monsters carry most
 * of the traffic, `statuses` has two entries — so the index has to decide
 * prominence rather than pretend they are peers. Grouping is the cheapest way
 * to do that without hiding anything.
 *
 * Types whose slice is not built are listed but inert. Showing the whole shape
 * is worth more than hiding the gaps, and a link that 404s is worse than one
 * that says plainly it is not here yet.
 */
export default function CompendiumPage() {
  return (
    <Box
      as="main"
      id="main"
      px={{ base: "5", md: "10" }}
      py={{ base: "10", md: "14" }}
      pb="24"
    >
      <Box maxW="6xl" mx="auto">
        <Stack gap="3" maxW="measure" mb={{ base: "10", md: "14" }}>
          <Heading
            as="h1"
            fontFamily="display"
            fontWeight="normal"
            fontSize={{ base: "3xl", md: "4xl" }}
            lineHeight="1.05"
            letterSpacing="tight"
          >
            Compendium
          </Heading>
          <Text
            className="prose"
            fontFamily="body"
            fontSize="md"
            lineHeight="1.65"
            color="fg.muted"
          >
            Everything from the books you own, filtered on the things you
            actually search by — and cross-linked to every entry that mentions
            it.
          </Text>
        </Stack>

        <Stack gap={{ base: "10", md: "12" }}>
          {DIRECTORY.map((group) => (
            <Box as="section" key={group.id}>
              <Text
                as="h2"
                fontFamily="ui"
                fontSize="2xs"
                fontWeight="semibold"
                letterSpacing="widest"
                textTransform="uppercase"
                color="fg.subtle"
                borderBottomWidth="1px"
                borderColor="border"
                pb="2"
                mb="4"
              >
                {group.label}
              </Text>

              <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap="3">
                {group.entries.map((entry) => (
                  <TypeCard key={entry.type} entry={entry} />
                ))}
              </SimpleGrid>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

function TypeCard({ entry }: { entry: DirectoryEntry }) {
  const ready = isImplemented(entry.type);

  const body = (
    <>
      <Text
        fontFamily="body"
        fontSize="md"
        fontWeight="medium"
        lineHeight="1.2"
        mb="1"
      >
        {entry.label}
      </Text>
      <Text
        className="prose"
        fontFamily="body"
        fontSize="xs"
        lineHeight="1.5"
        color="fg.muted"
      >
        {entry.blurb}
      </Text>
      {ready ? null : (
        <Text
          fontFamily="ui"
          fontSize="2xs"
          letterSpacing="wide"
          textTransform="uppercase"
          color="fg.subtle"
          mt="2"
        >
          Not yet built
        </Text>
      )}
    </>
  );

  const shared = {
    display: "flex",
    flexDirection: "column" as const,
    p: "4",
    bg: "bg.panel",
    borderWidth: "1px",
    borderColor: "border",
    rounded: "l1",
    h: "100%",
  };

  /**
   * An unbuilt type is a `<div>`, not a dimmed link. Rendering it as an anchor
   * would put it in the tab order and announce a destination that answers with
   * a 404.
   */
  if (!ready) {
    return (
      <Box {...shared} borderStyle="dashed" opacity="0.55">
        {body}
      </Box>
    );
  }

  return (
    <Box
      asChild
      {...shared}
      borderTopWidth="3px"
      borderTopColor="brand"
      transition="border-color .12s, background .12s"
      _hover={{ bg: "bg.muted", borderColor: "border.emphasized", borderTopColor: "brand" }}
    >
      <NextLink href={listHrefFor(entry.type)}>{body}</NextLink>
    </Box>
  );
}
