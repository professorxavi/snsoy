import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { Entries, type Entry } from "@/components/entry";
import { AsideIdentity } from "@/components/compendium/aside-identity";
import { ASIDE_IGNORE_ATTR } from "@/lib/aside";
import { splitSections } from "@/lib/content/outline";
import { descriptionEntries, entriesOf, raceTraits } from "@/lib/content/races";
import type { ReferenceIndex } from "@/lib/content/references";
import { hrefFor } from "@/lib/routes";
import type { RaceDetail, SubraceDetail } from "@/server/db/queries/races";
import { TraitSummary } from "./trait-summary";

/**
 * A race at aside width.
 *
 * The same bargain the class aside strikes. A race page carries its named
 * traits in full and every subrace under it — a PHB Tiefling has 12 — and none
 * of that reads in a 400px column. What belongs here is the question someone
 * meeting the word "Aasimar" mid-chapter actually has: what is it, what does it
 * do to my numbers, and is it what I want.
 */
export function RaceAside({
  race,
  refs,
}: {
  race: RaceDetail;
  refs: ReferenceIndex;
}) {
  const data = race.data as { entries?: Entry[] };

  // Its prose, which for 98 of the 134 races lives only in fluff.
  const { intro } = splitSections<Entry>(
    descriptionEntries<Entry>(race.fluff, data),
  );

  /*
   * The named entries of `data.entries` — Flight, Talons, Wind Caller — listed
   * by name only.
   *
   * Every race has these and they are the mechanical answer to "what does this
   * do", which prose often does not give. Printed as a line of names rather
   * than in full: a race's traits run to paragraphs each, and the point here is
   * to say what is on offer, not to reproduce it.
   */
  const traits = splitSections<Entry>(
    raceTraits<Entry>(data.entries, race.lineage),
  ).sections.map((section) => section.title);

  const href = hrefFor({
    entityType: "race",
    sourceId: race.sourceId,
    slug: race.slug,
  });

  return (
    <Stack gap="4" px="4" py="4">
      <AsideIdentity
        sourceId={race.sourceId}
        sourceName={race.sourceName}
        page={race.page}
        name={race.name}
      >
        <TraitSummary race={race} />

        {traits.length > 0 ? (
          <Box mt="2">
            <Text
              as="span"
              fontFamily="ui"
              fontSize="2xs"
              fontWeight="semibold"
              letterSpacing="wide"
              textTransform="uppercase"
              color="fg.subtle"
              mr="1.5"
            >
              Traits
            </Text>
            <Text as="span" fontFamily="body" fontSize="sm">
              {traits.join(", ")}
            </Text>
          </Box>
        ) : null}
      </AsideIdentity>

      {/*
        Said here as well as on the page. Someone who meets an NPC race in a
        chapter and opens it has the same question as someone who arrives at the
        page by URL — why is this not in the index — and the aside is where they
        are, so it cannot wait for a click through.
      */}
      {race.isNpcRace ? (
        <Text fontFamily="body" fontSize="xs" color="fg.muted">
          Listed for building NPCs rather than player characters, which is why
          it is absent from the races index.
        </Text>
      ) : null}

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
          <NextLink href={href}>
            Full page — traits
            {race.subraces.length > 0
              ? ` & ${race.subraces.length} subrace${race.subraces.length === 1 ? "" : "s"}`
              : ""}{" "}
            →
          </NextLink>
        </Text>
      ) : null}

      {intro.length > 0 ? (
        <Entries
          entries={intro}
          refs={refs}
          selfKey={race.naturalKey}
          context={race.name}
        />
      ) : null}
    </Stack>
  );
}

/**
 * One subrace at aside width.
 *
 * A subrace has no page and no URL — it is an anchor on its parent's — so this
 * is the only place its own numbers are ever shown on their own. Naming the
 * parent is the first thing it does: "Glasya" alone says nothing, and the
 * reader has just clicked the word in a sentence about tieflings.
 *
 * The same shape as a race: what it is, what it does to your numbers, what it
 * offers. What it does *not* do is repeat the parent — a subrace overrides some
 * of the three and inherits the rest, and printing the tiefling's spread here
 * would say Glasya grants it.
 */
export function SubraceAside({
  race,
  subrace,
  refs,
}: {
  race: RaceDetail;
  subrace: SubraceDetail;
  refs: ReferenceIndex;
}) {
  const data = subrace.data as { entries?: Entry[] };

  // A subrace's own line, which 45 of the 69 have. Never the parent's: the
  // books store a subrace's fluff as a copy of its parent's with one paragraph
  // prepended, and only that paragraph is kept.
  const { intro } = splitSections<Entry>(entriesOf<Entry>(subrace.fluff));

  const traits = splitSections<Entry>(data.entries).sections.map(
    (section) => section.title,
  );

  const href = hrefFor(
    {
      entityType: "subrace",
      sourceId: subrace.sourceId,
      slug: subrace.slug,
    },
    { entityType: "race", sourceId: race.sourceId, slug: race.slug },
  );

  return (
    <Stack gap="4" px="4" py="4">
      <AsideIdentity
        sourceId={subrace.sourceId}
        sourceName={subrace.sourceName}
        page={subrace.page}
        name={subrace.name}
      >
        <Text fontFamily="ui" fontSize="xs" color="fg.muted" mt="1">
          {race.name} subrace
        </Text>

        <TraitSummary race={subrace} />

        {traits.length > 0 ? (
          <Box mt="2">
            <Text
              as="span"
              fontFamily="ui"
              fontSize="2xs"
              fontWeight="semibold"
              letterSpacing="wide"
              textTransform="uppercase"
              color="fg.subtle"
              mr="1.5"
            >
              Traits
            </Text>
            <Text as="span" fontFamily="body" fontSize="sm">
              {traits.join(", ")}
            </Text>
          </Box>
        ) : null}
      </AsideIdentity>

      {href ? (
        <Text
          asChild
          {...{ [ASIDE_IGNORE_ATTR]: "" }}
          fontFamily="ui"
          fontSize="2xs"
          letterSpacing="wide"
          textTransform="uppercase"
          color="brand"
          _hover={{ textDecoration: "underline" }}
        >
          <NextLink href={href}>Full page — {race.name} →</NextLink>
        </Text>
      ) : null}

      {intro.length > 0 ? (
        <Entries
          entries={intro}
          refs={refs}
          selfKey={subrace.naturalKey}
          context={`${race.name}: ${subrace.name}`}
        />
      ) : null}
    </Stack>
  );
}
