import { Box, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import Image from "next/image";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { groupByBook } from "@/lib/content/chapters";
import { mediaUrl } from "@/lib/content/media";
import { chapterHref } from "@/lib/routes";
import {
  getSource,
  type ChapterListItem,
  type SourceDetail,
} from "@/server/db/queries/sources";

/**
 * One book or adventure: its cover, what it is, and the way in.
 *
 * The chapter list is the point of the page, so it is a full-width reading list
 * rather than a sidebar. Chapters keep the printed book's numbering — appendices
 * carry letters, front matter carries nothing — because that is how someone
 * holding the book will look for a chapter.
 */

interface RouteParams {
  params: Promise<{ source: string }>;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { source } = await params;
  const book = await getSource(source);

  if (!book) return { title: "Not found" };

  return {
    title: book.name,
    description: `${book.name}${book.published ? `, ${book.published.slice(0, 4)}` : ""} — ${book.chapters.length} chapters.`,
  };
}

export default async function SourcePage({ params }: RouteParams) {
  const { source } = await params;
  const book = await getSource(source);

  if (!book) notFound();

  const cover = book.coverPath ? mediaUrl(book.coverPath) : null;

  // A source with two bodies prints the inner work under its own heading — MOT
  // contains "No Silent Secret" — rather than running the chapters together.
  const bodies = groupByBook(book.chapters, book.id);

  return (
    <Box
      as="main"
      id="main"
      px={{ base: "5", md: "10" }}
      py={{ base: "8", md: "12" }}
      pb="24"
    >
      <Box maxW="4xl" mx="auto">
        <Box
          display="grid"
          gridTemplateColumns={{ base: "1fr", sm: "11rem minmax(0, 1fr)" }}
          gap={{ base: "5", sm: "8" }}
          mb={{ base: "8", md: "10" }}
        >
          {cover ? (
            <Box
              position="relative"
              aspectRatio="5 / 6.5"
              maxW={{ base: "12rem", sm: "none" }}
              bg="bg.muted"
              borderWidth="1px"
              borderColor="border"
              rounded="l1"
              overflow="hidden"
            >
              <Image
                src={cover}
                alt=""
                fill
                sizes="(max-width: 30em) 12rem, 11rem"
                style={{ objectFit: "cover" }}
                priority
              />
            </Box>
          ) : null}

          <Box>
            <Text
              fontFamily="ui"
              fontSize="2xs"
              fontWeight="medium"
              letterSpacing="widest"
              textTransform="uppercase"
              color="fg.subtle"
            >
              {book.isAdventure ? "Adventure" : "Sourcebook"}
            </Text>

            <Text
              as="h1"
              fontFamily="display"
              fontSize={{ base: "3xl", md: "4xl" }}
              lineHeight="1.05"
              letterSpacing="tight"
              textWrap="balance"
              mt="1"
            >
              {book.name}
            </Text>

            <Meta book={book} />
          </Box>
        </Box>

        {book.chapters.length === 0 ? (
          <NoBodyNote />
        ) : (
          <Stack gap={{ base: "8", md: "10" }}>
            {bodies.map((body) => (
              <Box as="section" key={body.bookId}>
                {/* Only named when there is more than one body to tell apart. */}
                {bodies.length > 1 ? (
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
                    mb="1"
                  >
                    {body.bookId === book.id ? book.name : body.chapters[0]!.name}
                  </Text>
                ) : null}

                <Stack gap="0">
                  {body.chapters.map((chapter) => (
                    <ChapterRow
                      key={`${chapter.bookId}-${chapter.slug}`}
                      sourceId={book.id}
                      chapter={chapter}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function Meta({ book }: { book: SourceDetail }) {
  const parts = [
    book.published
      ? new Date(book.published).toLocaleDateString("en-GB", {
          year: "numeric",
          month: "long",
        })
      : null,
    book.author,
    book.chapters.length > 0
      ? `${book.chapters.length} ${book.chapters.length === 1 ? "chapter" : "chapters"}`
      : null,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <Text
      fontFamily="ui"
      fontSize="xs"
      color="fg.muted"
      lineHeight="1.6"
      mt="3"
      pt="3"
      borderTopWidth="1px"
      borderColor="border"
    >
      {parts.join(" · ")}
    </Text>
  );
}

function ChapterRow({
  sourceId,
  chapter,
}: {
  sourceId: string;
  chapter: ChapterListItem;
}) {
  return (
    <Box
      asChild
      display="grid"
      gridTemplateColumns="2.5rem minmax(0, 1fr)"
      alignItems="baseline"
      gap="3"
      py="2.5"
      px="2"
      mx="-2"
      rounded="l1"
      borderBottomWidth="1px"
      borderColor="border"
      transition="background .1s"
      _hover={{ bg: "bg.muted" }}
    >
      <NextLink href={chapterHref(sourceId, chapter.slug)}>
        {/* Front matter and credits have no number; the column stays so the
            titles of numbered and unnumbered chapters still line up. */}
        <Text
          fontFamily="ui"
          fontSize="xs"
          fontWeight="semibold"
          color="fg.subtle"
          fontVariantNumeric="tabular-nums"
        >
          {chapter.ordinalLabel ?? ""}
        </Text>

        <Box>
          <Text fontFamily="body" fontSize="md" fontWeight="medium" lineHeight="1.3">
            {chapter.name}
          </Text>
          {chapter.headers?.length ? (
            <Text
              fontFamily="ui"
              fontSize="xs"
              color="fg.muted"
              lineHeight="1.5"
              mt="0.5"
              // One line: a chapter can carry twenty headings and the list is
              // meant to be scanned, not read.
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {chapter.headers.join(" · ")}
            </Text>
          ) : null}
        </Box>
      </NextLink>
    </Box>
  );
}

/**
 * Shown for a source that is cited by entities but whose body text the books
 * never published. Reachable only from an entity's source link, so the page
 * says why it is empty rather than 404ing on a real book.
 */
function NoBodyNote() {
  return (
    <Box
      as="aside"
      px="4"
      py="3"
      borderLeftWidth="2px"
      borderColor="border.emphasized"
      bg="bg.subtle"
    >
      <Text fontFamily="body" fontSize="sm" color="fg.muted">
        No chapters have been loaded for this book. Entries that cite it are
        still in the compendium.
      </Text>
    </Box>
  );
}
