import { Box, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import {
  fluffImages,
  Illustration,
  IllustrationBanner,
  IllustrationRow,
  imageCredits,
  isLandscape,
} from "@/components/compendium/entity-image";
import {
  OutlineNav,
  type OutlineItem,
} from "@/components/compendium/outline-nav";
import { SubraceList } from "@/components/compendium/subrace-accordion";
import { Entries, Inline, type Entry } from "@/components/entry";
import { ReadingColumn } from "@/components/layout";
import { splitSections } from "@/lib/content/outline";
import {
  formatAbilityBonuses,
  formatSize,
  formatSpeed,
} from "@/lib/content/races";
import { collectReferences } from "@/lib/content/references";
import { sourceHref } from "@/lib/routes";
import { resolveReferences } from "@/server/db/queries/references";
import {
  getRace,
  type RaceDetail,
  type SubraceDetail,
} from "@/server/db/queries/races";

/**
 * One race, as a reading page: a measured column with a section outline, like a
 * book chapter. Clicking a race navigates here; there is no aside.
 *
 * Subrace sections are anchored on the subrace's slug, which is what `hrefFor`
 * produces for a fragment (`/compendium/races/phb/dwarf#hill`). The ids here
 * and the resolver must agree or inbound links land in the wrong place.
 */

interface RouteParams {
  params: Promise<{ source: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { source, slug } = await params;
  const race = await getRace(source, slug);

  if (!race) return { title: "Not found" };

  return {
    title: `${race.name} · Races`,
    description: `${formatSize(race.size)} · ${formatSpeed(race.speed)}. ${race.sourceName}${race.page ? `, p. ${race.page}` : ""}.`,
  };
}

export default async function RacePage({ params }: RouteParams) {
  const { source, slug } = await params;
  const race = await getRace(source, slug);

  if (!race) notFound();

  const data = race.data as { entries?: Entry[] };
  const { intro, sections } = splitSections<Entry>(data.entries);

  // 111 of 134 races have illustrations, so this has to handle none. Subraces
  // are skipped: none have images, despite 68 claiming `hasFluffImages`.
  const images = fluffImages(race.fluff);
  const [lead, ...rest] = images;
  const credits = imageCredits(images);

  // One resolve for the whole page, parent and subraces together — otherwise
  // a Tiefling page would make fourteen round trips to build its links.
  const refs = await resolveReferences(
    collectReferences([race.data, ...race.subraces.map((s) => s.data)]),
  );

  // Subraces are listed together regardless of source. Roughly half come from
  // a different book than their parent race, named on each row.
  const outline: OutlineItem[] = [
    ...sections.map((section) => ({ id: section.id, label: section.title })),
    ...(race.subraces.length > 0
      ? [
          { id: SUBRACES_ID, label: "Subraces" },
          ...race.subraces.map((sub) => ({
            id: sub.slug,
            label: sub.name,
            depth: 1 as const,
          })),
        ]
      : []),
  ];

  return (
    <ReadingColumn outline={<OutlineNav items={outline} />}>
      {/*
        Normal flow, not a flex Stack: the illustration is floated so prose wraps
        around it, and a float has no effect inside a flex container. Spacing is
        carried on the blocks instead of a Stack gap.
      */}
      <Box>
        {/* Portrait and square art floats; landscape art gets a banner below. */}
        {lead && !isLandscape(lead) ? (
          <Box
            float={{ base: "none", sm: "right" }}
            w={{ base: "100%", sm: "15rem" }}
            maxW="100%"
            ml={{ base: "0", sm: "6" }}
            mb="4"
          >
            <Illustration
              image={lead}
              entityName={race.name}
              maxHeight={400}
              priority
            />
          </Box>
        ) : null}

        <Box as="header" mb="6">
          <Box>
            <Text
              fontFamily="ui"
              fontSize="2xs"
              fontWeight="medium"
              letterSpacing="widest"
              textTransform="uppercase"
              color="fg.subtle"
            >
              {/* Book name rather than abbreviation. */}
              <Box asChild _hover={{ color: "brand" }}>
                <NextLink href={sourceHref(race.sourceId)}>
                  {race.sourceName}
                </NextLink>
              </Box>
              {race.page ? ` · p. ${race.page}` : null}
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
              {race.name}
            </Text>

            {/* Wide art sits between the name and the stat line, so the stat
                line stays next to the traits it describes. */}
            {lead && isLandscape(lead) ? (
              <Box mt="4">
                <IllustrationBanner
                  image={lead}
                  entityName={race.name}
                  priority
                />
              </Box>
            ) : null}

            <TraitSummary race={race} />
          </Box>
        </Box>

        {race.isNpcRace ? <NpcRaceNote /> : null}

        {/* Prose before the first named trait. */}
        {intro.length > 0 ? (
          <Box mb="6">
            <Entries
              entries={intro}
              refs={refs}
              selfKey={race.naturalKey}
              context={race.name}
            />
          </Box>
        ) : null}

        {sections.map((section) => (
          <Box
            as="section"
            key={section.id}
            id={section.id}
            scrollMarginTop="4rem"
            mb="6"
          >
            <SectionHeading>
              <Inline text={section.title} refs={refs} context={race.name} />
            </SectionHeading>
            <Entries
              entries={section.entries}
              refs={refs}
              selfKey={race.naturalKey}
              context={race.name}
            />
          </Box>
        ))}

        {/* Clears the float so a tall illustration cannot push into the list. */}
        {rest.length > 0 ? (
          <Box clear="both" mb="6">
            <IllustrationRow images={rest} entityName={race.name} />
          </Box>
        ) : null}

        {/* Bodies are built here because they resolve cross-references against
            the database, then passed to the list as props. */}
        {race.subraces.length > 0 ? (
          <Box
            as="section"
            id={SUBRACES_ID}
            scrollMarginTop="4rem"
            clear="both"
          >
            <SectionHeading>Subraces</SectionHeading>
            <SubraceList
              items={race.subraces.map((sub) => toItem(sub, refs, race.name))}
            />
          </Box>
        ) : null}

        {/* Attribution collected here rather than captioned on each figure,
            where a float would strand it mid-section. */}
        {credits.length > 0 ? (
          <Box
            as="section"
            clear="both"
            mt="10"
            pt="4"
            borderTopWidth="1px"
            borderColor="border"
          >
            <Text
              as="h2"
              fontFamily="ui"
              fontSize="2xs"
              fontWeight="semibold"
              letterSpacing="widest"
              textTransform="uppercase"
              color="fg.subtle"
              mb="1"
            >
              Art credits
            </Text>
            <Text fontFamily="body" fontSize="sm" color="fg.muted">
              {credits.join(" · ")}
            </Text>
          </Box>
        ) : null}
      </Box>
    </ReadingColumn>
  );
}

const SUBRACES_ID = "subraces";

/**
 * Maps a subrace to a disclosure list item. The book is named in full on every
 * row, since it is the only thing distinguishing sources in one merged list.
 */
function toItem(
  sub: SubraceDetail,
  refs: Awaited<ReturnType<typeof resolveReferences>>,
  parentName: string,
) {
  return {
    id: sub.slug,
    name: sub.name,
    meta: [sub.sourceName, sub.page ? `p. ${sub.page}` : ""]
      .filter(Boolean)
      .join(" · "),
    body: <SubraceBody subrace={sub} refs={refs} parentName={parentName} />,
  };
}

/**
 * Shown on NPC races, which are excluded from the index. Anyone here arrived by
 * URL, search or bookmark, so the page says why it is not listed.
 */
function NpcRaceNote() {
  return (
    <Box
      as="aside"
      mb="6"
      px="4"
      py="3"
      borderLeftWidth="2px"
      borderColor="border.emphasized"
      bg="bg.subtle"
    >
      <Text fontFamily="body" fontSize="sm" color="fg.muted">
        The <Box as="i">Dungeon Master&rsquo;s Guide</Box> lists this race as an
        option for creating NPCs. It is not designed to be played as a player
        character, so it is left out of the races index.
      </Text>
    </Box>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text
      as="h2"
      /*
       * `flow-root` makes the heading establish its own formatting context,
       * which is what stops it overlapping the floated illustration. Without
       * it the text would wrap correctly but the rule underneath would run
       * straight across behind the artwork — a block's border spans the full
       * column even when its line boxes are shortened by a float.
       */
      display="flow-root"
      fontFamily="body"
      fontWeight="semibold"
      fontSize="lg"
      lineHeight="1.25"
      mb="2"
      pb="1"
      borderBottomWidth="1px"
      borderColor="border"
    >
      {children}
    </Text>
  );
}

/** Size, speed and ability bonuses. */
function TraitSummary({
  race,
  borderTop = true,
}: {
  race: RaceDetail | SubraceDetail;
  borderTop?: boolean;
}) {
  const parts = [
    { label: "Size", value: formatSize(race.size) },
    { label: "Speed", value: formatSpeed(race.speed) },
    { label: "Ability Scores", value: formatAbilityBonuses(race.ability) },
  ].filter((part) => part.value && part.value !== "—");

  if (parts.length === 0) return null;

  return (
    <Box
      display="flex"
      flexWrap="wrap"
      columnGap="5"
      rowGap="1"
      mt={borderTop ? "3" : "0"}
      pt={borderTop ? "3" : "0"}
      borderTopWidth={borderTop ? "1px" : "0"}
      borderColor="border"
    >
      {parts.map((part) => (
        <Box key={part.label}>
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
            {part.label}
          </Text>
          <Text as="span" fontFamily="body" fontSize="sm">
            {part.value}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/** A subrace's contents. No header: the disclosure trigger is the header. */
function SubraceBody({
  subrace,
  refs,
  parentName,
}: {
  subrace: SubraceDetail;
  refs: Awaited<ReturnType<typeof resolveReferences>>;
  parentName: string;
}) {
  const data = subrace.data as { entries?: Entry[] };

  return (
    <Box>
      <TraitSummary race={subrace} borderTop={false} />
      <Box mt="3">
        <Entries
          entries={data.entries}
          refs={refs}
          selfKey={subrace.naturalKey}
          context={`${parentName}: ${subrace.name}`}
        />
      </Box>
    </Box>
  );
}
