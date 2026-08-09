import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { Entries, type Entry } from "@/components/entry";
import { ASIDE_IGNORE_ATTR } from "@/lib/aside";
import { descriptionEntries } from "@/lib/content/classes";
import type { ReferenceIndex } from "@/lib/content/references";
import { splitSections } from "@/lib/content/outline";
import { hrefFor, sourceHref } from "@/lib/routes";
import type { ClassDetail } from "@/server/db/queries/classes";
import { ClassSummary } from "./class-summary";

/**
 * A class at aside width.
 *
 * Deliberately not the class page shrunk. A class page is a 20-level
 * progression table, every feature across those levels, and up to 130
 * subclasses with features of their own — 1,291 feature rows between the
 * seventeen classes. None of that is readable in a 400px column, and scrolling
 * a Wizard in one would be worse than not opening it.
 *
 * So this answers the question someone reading a chapter actually has when they
 * meet the word "Warlock": what is this, roughly, and is it what I want? That is
 * the identity line, the four numbers that characterise a class, and the
 * book's own opening description — then a way to the full page for everything
 * else.
 */
export function ClassAside({
  found,
  refs,
}: {
  found: ClassDetail;
  refs: ReferenceIndex;
}) {
  // The same unwrapping the class page does: a class's description is fluff,
  // wrapped in a section named after the class, with its named parts
  // ("Creating a Wizard") as sections. Only the opening prose belongs here.
  const { intro } = splitSections<Entry>(
    descriptionEntries<Entry>(found.fluff, found.name, found.sourceId),
  );

  const href = hrefFor({
    entityType: "class",
    sourceId: found.sourceId,
    slug: found.slug,
  });

  return (
    <Stack gap="4" px="4" py="4">
      <Box>
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
          {found.page ? ` · p. ${found.page}` : null}
        </Text>

        <Text
          as="h1"
          fontFamily="display"
          fontSize="2xl"
          lineHeight="1.05"
          letterSpacing="tight"
          textWrap="balance"
          mt="1"
        >
          {found.name}
        </Text>

        <ClassSummary found={found} />
      </Box>

      {/*
        Above the description, not below it.

        For a spell the aside is the whole spell and the link is an afterthought
        at the end. A class is the opposite: this is a triage view, the question
        being answered is "is this the class I want", and the answer is followed
        by wanting the rest of it. Putting the way there under six paragraphs of
        description would hide it below the fold, which is where it was.
      */}
      {href ? (
        <Text
          asChild
          // Navigates rather than reopening what is already showing.
          {...{ [ASIDE_IGNORE_ATTR]: "" }}
          fontFamily="ui"
          fontSize="2xs"
          letterSpacing="wide"
          textTransform="uppercase"
          color="brand"
          _hover={{ textDecoration: "underline" }}
        >
          {/* Pluralised the way the summary line pluralises it: a Barbarian
              has Primal Paths, not a Primal Path. */}
          <NextLink href={href}>
            Full page — table, features &amp;{" "}
            {found.subclassTitle
              ? `${found.subclassTitle.toLowerCase()}s`
              : "subclasses"}{" "}
            →
          </NextLink>
        </Text>
      ) : null}

      {intro.length > 0 ? (
        <Entries
          entries={intro}
          refs={refs}
          selfKey={found.naturalKey}
          context={found.name}
        />
      ) : null}
    </Stack>
  );
}
