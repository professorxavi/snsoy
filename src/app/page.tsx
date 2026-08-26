import { Box, Flex, Heading, SimpleGrid, Text } from "@chakra-ui/react";
import Image from "next/image";
import NextLink from "next/link";
import { mediaUrl } from "@/lib/content/media";
import { sourceHref } from "@/lib/routes";
import { onMainShelf } from "@/lib/content/shelf";
import { listSources, type SourceListItem } from "@/server/db/queries/sources";

const ENTRIES = [
  {
    href: "/compendium",
    title: "Compendium",
    body: "Look up what a spell does, then find every creature that casts it.",
  },
  {
    href: "/sources",
    title: "Sources",
    body: "Read a chapter the way it was printed, with nothing left to look up.",
  },
] as const;

/**
 * How much of the shelf the page shows.
 *
 * `listSources` leads with the core rulebooks and runs chronologically after
 * them, so a slice is the front of the shelf rather than an arbitrary cut.
 */
const SHELF = 12;

/**
 * The landing page: a masthead, two doors, and the shelf.
 *
 * The shelf is the only thing here that differs between installs — it is this
 * instance's own sources, which is what makes "everyone at the table can read
 * it" a demonstration rather than a claim. It costs the page its static
 * prerender, and that is the whole of its cost.
 */
export default async function Home() {
  // The main band only. The sources page files the promotional one-shots under
  // Odds and Ends and the Sage Advice Compendium under Errata and Rulings, and
  // a shelf meant to show what this instance carries should agree with it.
  const sources = (await listSources()).filter((source) =>
    onMainShelf(source.group),
  );

  return (
    <Box
      as="main"
      id="main"
      px={{ base: "5", md: "10" }}
      py={{ base: "12", md: "20" }}
      pb="24"
    >
      <Box maxW="6xl" mx="auto">
        {/*
          One name, one face. Alfa Slab One is the display face and this is what
          it is for; setting it as a 14px eyebrow over a 60px Literata title
          made the two halves of the name read as a label above a product.
        */}
        <Heading
          as="h1"
          fontFamily="display"
          fontWeight="normal"
          fontSize={{ base: "3xl", sm: "4xl", md: "5xl" }}
          lineHeight="1.05"
          letterSpacing="tight"
          textWrap="balance"
        >
          Sword{" "}
          <Text as="span" color="brand">
            &amp;
          </Text>{" "}
          Sorcery over Yonder
        </Heading>

        <Text
          className="prose"
          fontFamily="body"
          fontSize="lg"
          lineHeight="1.7"
          color="fg.muted"
          maxW="measure"
          mt="5"
        >
          The content is paid for. Everyone at the table can read it.
        </Text>

        <SimpleGrid
          columns={{ base: 1, md: 2 }}
          gap="4"
          mt={{ base: "12", md: "16" }}
        >
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
              rounded="l1"
              transition="border-color .12s, background .12s"
              _hover={{ bg: "bg.muted", borderColor: "border.emphasized" }}
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
                  pt="3"
                  fontFamily="ui"
                  fontSize="2xs"
                  fontWeight="semibold"
                  letterSpacing="widest"
                  textTransform="uppercase"
                  color="brand"
                >
                  Open &rarr;
                </Text>
              </NextLink>
            </Box>
          ))}
        </SimpleGrid>

        <Shelf sources={sources} />
      </Box>
    </Box>
  );
}

/**
 * The front of the shelf.
 *
 * One hairline under the row is the whole metaphor — no board, no texture. The
 * covers carry no caption because the row is a shelf rather than an index: each
 * one is a link named for its source, and the index itself is a click away.
 */
function Shelf({ sources }: { sources: SourceListItem[] }) {
  if (sources.length === 0) return null;

  return (
    <Box as="section" mt={{ base: "12", md: "16" }}>
      <Flex
        align="baseline"
        justify="space-between"
        gap="4"
        borderBottomWidth="1px"
        borderColor="border"
        pb="2"
        mb="4"
      >
        <Text
          as="h2"
          fontFamily="ui"
          fontSize="2xs"
          fontWeight="semibold"
          letterSpacing="widest"
          textTransform="uppercase"
          color="fg.subtle"
        >
          On the shelf
        </Text>
        <Box
          asChild
          fontFamily="ui"
          fontSize="2xs"
          letterSpacing="wide"
          textTransform="uppercase"
          color="brand"
          whiteSpace="nowrap"
          _hover={{ textDecoration: "underline" }}
        >
          <NextLink href="/sources">All sources &rarr;</NextLink>
        </Box>
      </Flex>

      {/* Scrolls in its own container, so a narrow viewport never pushes the
          page sideways. The bottom rule is the shelf edge. */}
      <Flex
        gap="3"
        overflowX="auto"
        pb="4"
        borderBottomWidth="1px"
        borderColor="border.emphasized"
      >
        {sources.slice(0, SHELF).map((source) => (
          <Spine key={source.id} source={source} />
        ))}
      </Flex>
    </Box>
  );
}

function Spine({ source }: { source: SourceListItem }) {
  const cover = source.coverPath ? mediaUrl(source.coverPath) : null;

  return (
    <Box
      asChild
      display="block"
      flex="none"
      w={{ base: "16", md: "20" }}
      _hover={{ "& .cover": { borderColor: "brand" } }}
    >
      {/*
        Labelled rather than captioned: nothing is printed under the cover, so
        the link needs its name from somewhere and the image is decorative.
      */}
      <NextLink href={sourceHref(source.id)} aria-label={source.name}>
        <Box
          className="cover"
          position="relative"
          aspectRatio="5 / 6.5"
          bg="bg.muted"
          borderWidth="1px"
          borderColor="border"
          rounded="l1"
          overflow="hidden"
          transition="border-color .12s"
        >
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="80px"
              style={{ objectFit: "cover" }}
            />
          ) : null}
        </Box>
      </NextLink>
    </Box>
  );
}
