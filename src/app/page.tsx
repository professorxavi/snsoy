import { Box, Flex, Grid, Heading, Text } from "@chakra-ui/react";
import Image from "next/image";
import NextLink from "next/link";
import { mediaUrl } from "@/lib/content/media";
import { sourceHref } from "@/lib/routes";
import { onMainShelf } from "@/lib/content/shelf";
import { listSources, type SourceListItem } from "@/server/db/queries/sources";

/**
 * The working destinations, and only the working ones.
 *
 * Character and campaign tools are named further down the page as a sentence,
 * never as an entry here: an entry is a door, and a door onto a room that does
 * not exist is the third card this page carried for months, 404ing.
 */
const ENTRIES = [
  {
    href: "/compendium",
    title: "Compendium",
    body: "Browse rules, creatures, equipment, and character options.",
  },
  {
    href: "/sources",
    title: "Sources",
    body: "Read your books chapter by chapter.",
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
 * The landing page: what the product is for, the two doors, and the shelf.
 *
 * The composition is deliberately asymmetric. The promise occupies the reading
 * column and the destinations attach to a ledger beside it, so the page reads
 * as a statement with a way in rather than as a menu with a caption.
 *
 * The shelf is the only thing here that differs between installs — it is this
 * instance's own sources, which is what makes "your books" a demonstration
 * rather than a claim. It costs the page its static prerender, and that is the
 * whole of its cost.
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
          Three children, explicitly placed: the eyebrow sits top-right, the
          thesis takes the whole left column, and the ledger sits under the
          eyebrow. Source order is the mobile order — eyebrow, name, promise,
          doors — so the single-column stack needs no reordering of its own.
        */}
        <Grid
          templateColumns={{
            base: "1fr",
            lg: "minmax(0, 1.1fr) minmax(300px, 0.9fr)",
          }}
          columnGap={{ lg: "16" }}
          rowGap={{ base: "8", lg: "10" }}
          alignItems="start"
        >
          <Text
            gridColumn={{ lg: "2" }}
            gridRow={{ lg: "1" }}
            fontFamily="ui"
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="widest"
            textTransform="uppercase"
            color="fg.subtle"
            textAlign={{ base: "left", lg: "right" }}
          >
            Your table / your rules
          </Text>

          <Box gridColumn={{ lg: "1" }} gridRow={{ lg: "1 / span 2" }}>
            {/*
              One name, one face. Alfa Slab One is the display face and this is
              what it is for; setting it as a 14px eyebrow over a 60px Literata
              title made the two halves of the name read as a label above a
              product.
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
              fontSize={{ base: "2xl", md: "3xl" }}
              lineHeight="1.25"
              letterSpacing="tight"
              textWrap="balance"
              maxW="measure"
              mt={{ base: "6", md: "8" }}
            >
              The game stays yours.
            </Text>

            <Text
              className="prose"
              fontFamily="body"
              fontSize="lg"
              lineHeight="1.7"
              color="fg.muted"
              maxW="measure"
              mt="5"
              textWrap="pretty"
            >
              Read the books, build characters, and run your table with the
              rules your group chose.
            </Text>
          </Box>

          <Ledger />
        </Grid>

        {/*
          Stated, not offered. A sentence cannot be clicked, which is the point:
          it says what is coming without putting a dead destination on the page.
        */}
        <Text
          fontFamily="ui"
          fontSize="xs"
          color="fg.subtle"
          mt={{ base: "10", md: "14" }}
        >
          Character and campaign tools are coming to the table.
        </Text>

        <Shelf sources={sources} />
      </Box>
    </Box>
  );
}

/**
 * The two doors, as a ledger rather than a pair of cards.
 *
 * One block under one head rule, entries divided by hairlines — the grouping is
 * the rules themselves, so two destinations read as one set of choices instead
 * of two floating panels. A landmark rather than a heading: the composition
 * gives it no room for a title, and a named `nav` says what it is to a screen
 * reader without inventing one.
 *
 * The rules bleed past the text on both sides, which is why the rows carry the
 * padding and the block pulls it back — text stays aligned with the page, and
 * the hover band and hairlines overhang it the way a printed rule does.
 */
function Ledger() {
  return (
    <Box
      as="nav"
      aria-label="Where to start"
      gridColumn={{ lg: "2" }}
      gridRow={{ lg: "2" }}
      position="relative"
      mx="-3"
      borderTopWidth="2px"
      borderTopColor="fg"
    >
      <RegistrationMark />
      {ENTRIES.map((entry) => (
        <LedgerRow key={entry.href} entry={entry} />
      ))}
    </Box>
  );
}

/**
 * The page's one two-pass signature: two rings, offset, straddling the head
 * rule where the app's column meets the shelf's.
 *
 * Rings drawn as bordered boxes rather than an inline `<svg>` — the semantic
 * tokens are consumed directly, so the mark cannot render in the wrong ink or
 * in no ink at all, which is what an SVG naming `--chakra-colors-*` by hand
 * risks. Nothing else on this page gets a chromatic flourish.
 */
function RegistrationMark() {
  return (
    <Box
      aria-hidden="true"
      position="absolute"
      right="3"
      top="0"
      w="19px"
      h="12px"
      transform="translateY(-50%)"
    >
      <Box
        position="absolute"
        left="0"
        boxSize="12px"
        borderWidth="1.5px"
        borderColor="brand"
        borderRadius="full"
      />
      <Box
        position="absolute"
        left="7px"
        boxSize="12px"
        borderWidth="1.5px"
        borderColor="reference"
        borderRadius="full"
      />
    </Box>
  );
}

function LedgerRow({ entry }: { entry: (typeof ENTRIES)[number] }) {
  return (
    <Box
      asChild
      display="block"
      px="3"
      py="4"
      borderBottomWidth="1px"
      borderColor="border"
      transition="background-color .15s"
      _hover={{
        bg: "bg.muted",
        "& .ledger-arrow": { transform: "translateX(3px)" },
      }}
      /* The shift explains the link and carries nothing, so it goes entirely. */
      _motionReduce={{
        transition: "none",
        _hover: { "& .ledger-arrow": { transform: "none" } },
      }}
    >
      <NextLink href={entry.href}>
        <Flex align="center" justify="space-between" gap="3" minH="6">
          <Text
            fontFamily="ui"
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="widest"
            textTransform="uppercase"
          >
            {entry.title}
          </Text>
          <Box
            className="ledger-arrow"
            aria-hidden="true"
            color="brand"
            transition="transform .15s"
          >
            &rarr;
          </Box>
        </Flex>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="sm"
          lineHeight="1.6"
          color="fg.muted"
          mt="1"
          textWrap="pretty"
        >
          {entry.body}
        </Text>
      </NextLink>
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
          display="flex"
          alignItems="center"
          justifyContent="center"
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
          ) : (
            /*
              A book with no cover keeps the row's dimensions and says which
              book it is, rather than leaving a blank tile the reader has to
              hover to identify. Decorative: the link is already named.
            */
            <Text
              aria-hidden="true"
              fontFamily="ui"
              fontSize="2xs"
              fontWeight="semibold"
              letterSpacing="wide"
              color="fg.subtle"
              px="1"
              textAlign="center"
              textWrap="balance"
            >
              {source.id}
            </Text>
          )}
        </Box>
      </NextLink>
    </Box>
  );
}
