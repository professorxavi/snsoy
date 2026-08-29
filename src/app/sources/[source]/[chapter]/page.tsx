import { Box, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { openEntityAside } from "@/app/aside-actions";
import { AsideLinks } from "@/components/compendium/aside-links";
import { ChapterBar, ChapterNav } from "@/components/compendium/chapter-nav";
import { ChapterOutline } from "@/components/compendium/chapter-outline";
import { Entries, Inline, type Entry } from "@/components/entry";
import { ReadingColumn } from "@/components/layout";
import { chapterLabel } from "@/lib/content/chapters";
import { chapterOutline, splitSections } from "@/lib/content/outline";
import {
  collectAreaTargets,
  collectReferences,
} from "@/lib/content/references";
import { sourceHref } from "@/lib/routes";
import {
  resolveAreas,
  resolveReferences,
} from "@/server/db/queries/references";
import { getChapter } from "@/server/db/queries/sources";

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
  // 37,000 creature tags across the books — so this is by far the largest
  // reference set any page builds, and it must stay a single round trip.
  const refs = await resolveReferences(collectReferences(found.data));

  // `{@area}` addresses a position inside a chapter rather than an entity, so
  // it resolves against the book's own sections instead of `entities`.
  const { hrefs: areas, anchored } = await resolveAreas(
    found.sourceId,
    chapter,
    collectAreaTargets(found.data),
  );

  // Three levels, so the outline names what is actually in the chapter rather
  // than the handful of sections it divides into. `anchors` is the other half
  // of that: a heading nothing links to still has to be reachable from a row.
  const outline = chapterOutline(sections);

  return (
    <ReadingColumn
      outline={
        outline.nodes.length > 0 ? (
          <ChapterOutline items={outline.nodes} />
        ) : undefined
      }
      outlineLabel="In this chapter"
    >
      <ChapterBar
        sourceId={found.sourceId}
        sourceName={found.sourceName}
        previous={found.previous}
        next={found.next}
        hasContents={found.chapterCount > 1}
      />

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

      {/*
        Everything below opens in the aside rather than navigating: a chapter is
        dense with cross-references, and following one should not cost the page
        you are reading. The renderer is untouched — these are the same anchors
        it has always emitted, caught on the way up.
      */}
      <AsideLinks load={openEntityAside}>
        {intro.length > 0 ? (
          <Box mb="8">
            <Entries
              entries={intro}
              refs={refs}
              areas={areas}
              anchored={anchored}
              outlineAnchors={outline.anchors}
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
            {/*
            The section's own id from the data, alongside the slug the outline
            uses. An element carries one id, so the second is an empty div at
            the top of the section — 713 `{@area}` tags address a top-level
            section, and `splitSections` unwraps the entry before the renderer
            can mark it. Both anchors land in the same place.
          */}
            {section.anchorId && anchored[section.anchorId] ? (
              <Box id={section.anchorId} scrollMarginTop="4rem" />
            ) : null}

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
              <Inline
                text={section.title}
                refs={refs}
                areas={areas}
                context={found.name}
              />
            </Text>
            <Entries
              entries={section.entries}
              refs={refs}
              areas={areas}
              anchored={anchored}
              outlineAnchors={outline.anchors}
              selfKey={found.naturalKey}
              context={found.name}
              /*
               * The heading above is this page's, not the renderer's:
               * `splitSections` lifts a named section out so the page can set its
               * own rule and anchor, which means nothing downstream would
               * otherwise know the name a reader can see. Anything inside that
               * needs naming — an uncaptioned table's scroll region — takes it
               * from here until a nested section supplies a nearer one.
               */
              sectionName={section.title}
              headingLevel={3}
            />
          </Box>
        ))}
      </AsideLinks>

      <ChapterNav
        sourceId={found.sourceId}
        previous={found.previous}
        next={found.next}
      />
    </ReadingColumn>
  );
}
