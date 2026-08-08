import { Box, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import {
  OutlineNav,
  type OutlineItem,
} from "@/components/compendium/outline-nav";
import { Entries, Inline, type Entry } from "@/components/entry";
import { ReadingColumn } from "@/components/layout";
import { chapterLabel } from "@/lib/content/chapters";
import { splitSections } from "@/lib/content/outline";
import { collectReferences } from "@/lib/content/references";
import { chapterHref, sourceHref } from "@/lib/routes";
import { resolveReferences } from "@/server/db/queries/references";
import { getChapter, type ChapterDetail } from "@/server/db/queries/sources";

/**
 * One chapter of a book or adventure.
 *
 * A chapter's stored body is itself a `section` entry — the chapter title and
 * page are already on the entity — so this renders `data.entries`, not `data`.
 * Its named children become the outline and the page's `h2`s, which is why the
 * renderer starts at heading level 2 here and 3 on a spell or race page.
 */

interface RouteParams {
  params: Promise<{ source: string; chapter: string }>;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { source, chapter } = await params;
  const found = await getChapter(source, chapter);

  if (!found) return { title: "Not found" };

  return {
    title: `${found.name} · ${found.sourceName}`,
    description: `${chapterLabel(found) ?? found.name}, ${found.sourceName}${found.page ? `, p. ${found.page}` : ""}.`,
  };
}

export default async function ChapterPage({ params }: RouteParams) {
  const { source, chapter } = await params;
  const found = await getChapter(source, chapter);

  if (!found) notFound();

  const data = found.data as { entries?: Entry[] };
  const { intro, sections } = splitSections<Entry>(data.entries);

  // One resolve for the whole chapter. Body text is dense with references —
  // 37,000 creature tags across the corpus — so this is by far the largest
  // reference set any page builds, and it must stay a single round trip.
  const refs = await resolveReferences(collectReferences(found.data));

  const outline: OutlineItem[] = sections.map((section) => ({
    id: section.id,
    label: section.title,
  }));

  return (
    <ReadingColumn
      outline={
        outline.length > 0 ? (
          <OutlineNav items={outline} label="In this chapter" />
        ) : undefined
      }
      outlineLabel="In this chapter"
    >
      <Box as="header" mb="8">
        <Text
          fontFamily="ui"
          fontSize="2xs"
          fontWeight="medium"
          letterSpacing="widest"
          textTransform="uppercase"
          color="fg.subtle"
        >
          <Box asChild _hover={{ color: "brand" }}>
            <NextLink href={sourceHref(found.sourceId)}>
              {found.sourceName}
            </NextLink>
          </Box>
          {chapterLabel(found) ? ` · ${chapterLabel(found)}` : null}
          {found.page ? ` · p. ${found.page}` : null}
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
          {found.name}
        </Text>
      </Box>

      {intro.length > 0 ? (
        <Box mb="8">
          <Entries
            entries={intro}
            refs={refs}
            selfKey={found.naturalKey}
            context={found.name}
            headingLevel={2}
          />
        </Box>
      ) : null}

      {sections.map((section) => (
        <Box
          as="section"
          key={section.id}
          id={section.id}
          scrollMarginTop="4rem"
          mb="8"
        >
          <Text
            as="h2"
            fontFamily="display"
            fontSize={{ base: "xl", md: "2xl" }}
            lineHeight="1.15"
            letterSpacing="tight"
            textWrap="balance"
            mb="3"
            pb="1.5"
            borderBottomWidth="1px"
            borderColor="border"
          >
            <Inline text={section.title} refs={refs} context={found.name} />
          </Text>
          <Entries
            entries={section.entries}
            refs={refs}
            selfKey={found.naturalKey}
            context={found.name}
            headingLevel={3}
          />
        </Box>
      ))}

      <ChapterNav chapter={found} />
    </ReadingColumn>
  );
}

/**
 * Previous and next, which is how a book is actually read. Both come from a
 * walk over the whole source, so they cross the seam into a second body rather
 * than stopping at the end of the first.
 */
function ChapterNav({ chapter }: { chapter: ChapterDetail }) {
  if (!chapter.previous && !chapter.next) return null;

  return (
    <Box
      as="nav"
      aria-label="Chapter"
      display="grid"
      gridTemplateColumns={{ base: "1fr", sm: "1fr 1fr" }}
      gap="3"
      mt="12"
      pt="6"
      borderTopWidth="1px"
      borderColor="border"
    >
      {chapter.previous ? (
        <NavLink
          sourceId={chapter.sourceId}
          slug={chapter.previous.slug}
          direction="Previous"
          name={chapter.previous.name}
        />
      ) : (
        <Box />
      )}
      {chapter.next ? (
        <NavLink
          sourceId={chapter.sourceId}
          slug={chapter.next.slug}
          direction="Next"
          name={chapter.next.name}
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
