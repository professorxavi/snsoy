import { Box, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { LuChevronLeft, LuChevronRight, LuList } from "react-icons/lu";
import { chapterLabel } from "@/lib/content/chapters";
import { chapterHref, sourceHref } from "@/lib/routes";

/**
 * Moving through a book.
 *
 * Two navigations over the same three destinations, at the two moments a reader
 * wants them. The bar sits above the chapter title, where someone who has just
 * arrived looks to find out where they are and to step somewhere else without
 * reading first. The pair of cards sits at the foot, where someone who has read
 * to the end is already looking for what comes next.
 *
 * Both address a neighbour by slug under the source, never by the body it came
 * from — that is what lets a step forward cross into an inner work.
 */

/** A chapter either side of this one, as the chapter query returns it. */
export interface ChapterNeighbour {
  name: string;
  slug: string;
  ordinalType: string | null;
  ordinalLabel: string | null;
}

interface ChapterNavProps {
  sourceId: string;
  previous: ChapterNeighbour | null;
  next: ChapterNeighbour | null;
}

/**
 * The bar above the title: back, the book's contents, forward.
 *
 * The contents link is the reason this exists — until now the only way back to
 * the chapter list was the book's name in the eyebrow above the title, which
 * reads as provenance rather than as a way out.
 */
export function ChapterBar({
  sourceId,
  sourceName,
  previous,
  next,
  hasContents,
}: ChapterNavProps & {
  sourceName: string;
  /** False for a source whose whole body is this one chapter. */
  hasContents: boolean;
}) {
  if (!previous && !next && !hasContents) return null;

  return (
    <Box
      as="nav"
      aria-label="Chapter"
      display="grid"
      // The centre column holds its place whether or not either neighbour
      // exists, so "Contents" stays centred on the first and last chapters.
      gridTemplateColumns="minmax(0, 1fr) auto minmax(0, 1fr)"
      alignItems="center"
      gap="3"
      mb="6"
      pb="2"
      borderBottomWidth="1px"
      borderColor="border"
    >
      {previous ? (
        <BarLink href={chapterHref(sourceId, previous.slug)} justify="start">
          <LuChevronLeft aria-hidden />
          <StepLabel chapter={previous} />
        </BarLink>
      ) : (
        <Box />
      )}

      {hasContents ? (
        <BarLink
          href={sourceHref(sourceId)}
          justify="center"
          label={`Contents of ${sourceName}`}
        >
          <LuList aria-hidden />
          <Box as="span">Contents</Box>
        </BarLink>
      ) : (
        <Box />
      )}

      {next ? (
        <BarLink href={chapterHref(sourceId, next.slug)} justify="end">
          <StepLabel chapter={next} />
          <LuChevronRight aria-hidden />
        </BarLink>
      ) : (
        <Box />
      )}
    </Box>
  );
}

/**
 * "Ch. 5 · Equipment", or just the name where there is no number. Abbreviated
 * because this line has three things on it and a phone has room for one.
 */
function StepLabel({ chapter }: { chapter: ChapterNeighbour }) {
  const label = chapterLabel(chapter)?.replace(/^Chapter /, "Ch. ");

  return (
    <Box as="span" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
      {label ? (
        <Box as="span" color="fg.subtle" display={{ base: "none", sm: "inline" }}>
          {label} ·{" "}
        </Box>
      ) : null}
      {chapter.name}
    </Box>
  );
}

function BarLink({
  href,
  justify,
  label,
  children,
}: {
  href: string;
  justify: "start" | "center" | "end";
  label?: string;
  children: ReactNode;
}) {
  return (
    <Box
      asChild
      display="flex"
      alignItems="center"
      justifyContent={justify}
      gap="1.5"
      minW="0"
      fontFamily="ui"
      fontSize="xs"
      color="fg.muted"
      transition="color .12s"
      _hover={{ color: "brand" }}
    >
      <NextLink href={href} aria-label={label}>
        {children}
      </NextLink>
    </Box>
  );
}

/**
 * Previous and next at the foot of the chapter, which is how a book is actually
 * read. Both come from a walk over the whole source, so they cross the seam
 * into a second body rather than stopping at the end of the first.
 */
export function ChapterNav({ sourceId, previous, next }: ChapterNavProps) {
  if (!previous && !next) return null;

  return (
    <Box
      as="nav"
      aria-label="Continue reading"
      display="grid"
      gridTemplateColumns={{ base: "1fr", sm: "1fr 1fr" }}
      gap="3"
      mt="12"
      pt="6"
      borderTopWidth="1px"
      borderColor="border"
    >
      {previous ? (
        <NavLink
          sourceId={sourceId}
          slug={previous.slug}
          direction="Previous"
          name={previous.name}
        />
      ) : (
        <Box />
      )}
      {next ? (
        <NavLink
          sourceId={sourceId}
          slug={next.slug}
          direction="Next"
          name={next.name}
          align="end"
        />
      ) : null}
    </Box>
  );
}

function NavLink({
  sourceId,
  slug,
  direction,
  name,
  align = "start",
}: {
  sourceId: string;
  slug: string;
  direction: string;
  name: string;
  align?: "start" | "end";
}) {
  return (
    <Box
      asChild
      display="block"
      textAlign={align}
      px="4"
      py="3"
      rounded="l1"
      borderWidth="1px"
      borderColor="border"
      transition="background .12s, border-color .12s"
      _hover={{ bg: "bg.muted", borderColor: "border.emphasized" }}
    >
      <NextLink href={chapterHref(sourceId, slug)}>
        <Text
          fontFamily="ui"
          fontSize="2xs"
          fontWeight="semibold"
          letterSpacing="widest"
          textTransform="uppercase"
          color="fg.subtle"
        >
          {direction}
        </Text>
        <Text fontFamily="body" fontSize="sm" fontWeight="medium" mt="0.5">
          {name}
        </Text>
      </NextLink>
    </Box>
  );
}
