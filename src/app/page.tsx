import { Box, Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";

/**
 * Placeholder landing page.
 *
 * The counts below are hardcoded on purpose: Phase 3b has no data layer, and
 * the corpus is fixed by a one-shot ingest, so these are accurate rather than
 * invented. Swap them for a query when the compendium slices land.
 */
const CORPUS = [
  { value: "13,370", label: "Entities" },
  { value: "66,796", label: "Cross-references" },
  { value: "1,006", label: "Chapters" },
  { value: "144", label: "Sources" },
] as const;

const ENTRIES = [
  {
    href: "/compendium",
    title: "Compendium",
    body: "Every spell, creature, item and rule, filtered on the facets that actually matter — and cross-linked to everything that mentions them.",
    meta: "3,808 creatures · 3,501 items · 525 spells",
  },
  {
    href: "/sources",
    title: "Sources",
    body: "The full text of every book and adventure, chapter by chapter, with references resolved inline as you read.",
    meta: "51 books · 79 adventures",
  },
  {
    href: "/search",
    title: "Search",
    body: "One field across names and body text, so a half-remembered phrase from a chapter finds the thing you meant.",
    meta: "Full-text across the corpus",
  },
] as const;

export default function Home() {
  return (
    <Box as="main" id="main" px={{ base: "5", md: "10" }} py={{ base: "10", md: "16" }} pb="24">
      <Box maxW="5xl" mx="auto">
        <Stack gap="5" maxW="measure">
          <Box>
            <Text fontFamily="display" fontSize="sm" letterSpacing="wide" color="brand" mb="1">
              SWORD &amp; SORCERY
            </Text>
            <Heading
              as="h1"
              fontFamily="heading"
              fontWeight="semibold"
              fontSize={{ base: "4xl", md: "5xl" }}
              lineHeight="1.07"
              letterSpacing="tight"
              textWrap="balance"
            >
              over Yonder
            </Heading>
          </Box>

          <Text className="prose" fontFamily="body" fontSize="lg" lineHeight="1.7" color="fg.muted">
            A compendium and character toolset for the 2014 ruleset of the fifth
            edition of the world&rsquo;s greatest role-playing game. You paid for
            the content, you should be able to access it without being forced to
            play the new edition.
          </Text>
        </Stack>

        {/* Corpus at a glance */}
        <SimpleGrid
          columns={{ base: 2, md: 4 }}
          mt={{ base: "10", md: "14" }}
          borderTopWidth="1px"
          borderColor="border"
        >
          {CORPUS.map((stat) => (
            <Box
              key={stat.label}
              py="4"
              pr="4"
              borderBottomWidth={{ base: "1px", md: "0" }}
              borderColor="border"
            >
              <Text
                fontFamily="display"
                fontSize={{ base: "2xl", md: "3xl" }}
                lineHeight="1"
                fontVariantNumeric="tabular-nums"
              >
                {stat.value}
              </Text>
              <Text
                mt="1.5"
                fontSize="2xs"
                letterSpacing="widest"
                textTransform="uppercase"
                color="fg.subtle"
                fontWeight="semibold"
              >
                {stat.label}
              </Text>
            </Box>
          ))}
        </SimpleGrid>

        {/* Entry points */}
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="4" mt={{ base: "10", md: "14" }}>
          {ENTRIES.map((entry) => (
            <Box
              key={entry.href}
              asChild
              display="flex"
              flexDirection="column"
              gap="2"
              p="5"
              bg="bg.panel"
              borderWidth="1px"
              borderColor="border"
              borderTopWidth="3px"
              borderTopColor="brand"
              rounded="l1"
              transition="border-color .12s, background .12s"
              _hover={{ bg: "bg.muted", borderColor: "border.emphasized", borderTopColor: "brand" }}
            >
              <NextLink href={entry.href}>
                <Text fontFamily="display" fontSize="xl" lineHeight="1.1">
                  {entry.title}
                </Text>
                <Text
                  className="prose"
                  fontFamily="body"
                  fontSize="sm"
                  lineHeight="1.6"
                  color="fg.muted"
                >
                  {entry.body}
                </Text>
                <Text
                  mt="auto"
                  pt="2"
                  fontSize="2xs"
                  letterSpacing="wider"
                  textTransform="uppercase"
                  color="fg.subtle"
                  fontVariantNumeric="tabular-nums"
                >
                  {entry.meta}
                </Text>
              </NextLink>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
