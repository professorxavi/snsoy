import { Box, Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import Image from "next/image";
import NextLink from "next/link";
import { mediaUrl } from "@/lib/content/media";
import { readString, withValue, type QueryParams } from "@/lib/query-params";
import { sourceHref } from "@/lib/routes";
import { listSources, type SourceListItem } from "@/server/db/queries/sources";

export const metadata: Metadata = {
  title: "Sources",
  description: "Every book and adventure, and the chapters inside them.",
};

/**
 * The source index.
 *
 * Books and adventures share one tree — both are `sources` rows read through
 * the same reader — so `kind` is a filter here rather than a separate route.
 * Covers do the work of identifying a book, which is why this is a grid and not
 * the grouped list the compendium types use.
 */

const KINDS = [
  { value: undefined, label: "All" },
  { value: "books", label: "Books" },
  { value: "adventures", label: "Adventures" },
] as const;

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const kind = readString(params, "kind");
  const all = await listSources();

  const shown = all.filter((source) => {
    if (kind === "books") return !source.isAdventure;
    if (kind === "adventures") return source.isAdventure;
    return true;
  });

  return (
    <Box
      as="main"
      id="main"
      px={{ base: "5", md: "10" }}
      py={{ base: "10", md: "14" }}
      pb="24"
    >
      <Box maxW="6xl" mx="auto">
        <Stack gap="3" maxW="measure" mb={{ base: "8", md: "10" }}>
          <Heading
            as="h1"
            fontFamily="display"
            fontWeight="normal"
            fontSize={{ base: "3xl", md: "4xl" }}
            lineHeight="1.05"
            letterSpacing="tight"
          >
            Sources
          </Heading>
          <Text
            className="prose"
            fontFamily="body"
            fontSize="md"
            lineHeight="1.65"
            color="fg.muted"
          >
            Your books, chapter by chapter, exactly as they were printed.
          </Text>
        </Stack>

        <Box
          as="nav"
          aria-label="Filter by kind"
          display="flex"
          gap="1"
          mb={{ base: "6", md: "8" }}
          pb="3"
          borderBottomWidth="1px"
          borderColor="border"
        >
          {KINDS.map((option) => {
            const active = kind === option.value;
            return (
              <Box
                key={option.label}
                asChild
                fontFamily="ui"
                fontSize="xs"
                fontWeight={active ? "semibold" : "normal"}
                px="3"
                py="1.5"
                rounded="l1"
                color={active ? "fg" : "fg.muted"}
                bg={active ? "bg.muted" : "transparent"}
                _hover={{ bg: "bg.muted", color: "fg" }}
              >
                <NextLink
                  href={`/sources${withValue(params, "kind", option.value)}`}
                  aria-current={active ? "page" : undefined}
                >
                  {option.label}
                </NextLink>
              </Box>
            );
          })}
        </Box>

        <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 6 }} gap={{ base: "4", md: "6" }}>
          {shown.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}

function SourceCard({ source }: { source: SourceListItem }) {
  const cover = source.coverPath ? mediaUrl(source.coverPath) : null;

  return (
    <Box asChild display="block" _hover={{ "& .cover": { borderColor: "brand" } }}>
      <NextLink href={sourceHref(source.id)}>
        {/*
          A fixed 5:6.5 box rather than the cover's own ratio: covers vary
          enough that letting each size itself leaves the grid ragged, and a
          shelf of books reads best when the spines line up.
        */}
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
              sizes="(max-width: 30em) 45vw, (max-width: 48em) 30vw, 15rem"
              style={{ objectFit: "cover" }}
            />
          ) : null}
        </Box>

        <Text
          fontFamily="body"
          fontSize="sm"
          fontWeight="medium"
          lineHeight="1.25"
          mt="2"
          textWrap="pretty"
        >
          {source.name}
        </Text>
        <Text fontFamily="ui" fontSize="2xs" color="fg.subtle" mt="0.5">
          {[
            source.published?.slice(0, 4),
            source.chapterCount > 0
              ? `${source.chapterCount} ${source.chapterCount === 1 ? "chapter" : "chapters"}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </NextLink>
    </Box>
  );
}
