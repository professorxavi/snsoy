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
import {
  formatAbilityBonuses,
  formatSize,
  formatSpeed,
} from "@/lib/content/races";
import { collectReferences } from "@/lib/content/references";
import { resolveReferences } from "@/server/db/queries/references";
import {
  getRace,
  type RaceDetail,
  type SubraceDetail,
} from "@/server/db/queries/races";

/**
 * One race, as a reading page.
 *
 * A race is a small document, not a row: its traits are sections, and its
 * subraces are further sections built on top of them. So this uses the same
 * layout as a book chapter — a measured column with the outline on the trailing
 * edge — rather than anything from the browse pattern. Clicking a race
 * navigates here; there is no aside.
 *
 * Subrace sections are anchored on the subrace's own **slug**, because that is
 * what `hrefFor` produces for a fragment (`/compendium/races/phb/dwarf#hill`).
 * Every `{@race dwarf (hill)}` in the corpus resolves to that URL, so the id
 * here and the resolver there have to agree or ~93 inbound links land on the
 * right page at the wrong place.
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
  const { intro, sections } = splitSections(data.entries);

  /**
   * 111 of 134 races carry illustrations; the rest carry none, so every part of
   * this has to be absent-safe rather than merely empty. Subraces are skipped
   * deliberately — none have images, despite 68 of them claiming `hasFluffImages`.
   */
  const images = fluffImages(race.fluff);
  const [lead, ...rest] = images;
  const credits = imageCredits(images);

  // One resolve for the whole page, parent and subraces together — otherwise
  // a Tiefling page would make fourteen round trips to build its links.
  const refs = await resolveReferences(
    collectReferences([race.data, ...race.subraces.map((s) => s.data)]),
  );

  /**
   * One list, whichever book each subrace came from.
   *
   * Roughly half the corpus's subraces are printed in a different book than
   * their parent race — MTF adds Duergar to the PHB dwarf, Eberron adds the
   * dragonmarks — and they were briefly split into their own section. They are
   * not split any more: a player asking "what dwarves can I play" wants the
   * whole answer in one place, which is also what D&D Beyond shows. The book
   * each one came from is named on its row instead.
   */
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
        A plain block, not a flex Stack.

        The illustration is *floated* so the prose runs around it the way it does
        on a printed page. A float has no effect inside a flex container — its
        siblings sit beside it as flex items instead of wrapping — so the whole
        column has to be normal flow, with spacing carried on the blocks
        themselves.
      */}
      <Box>
        {/*
          Only portrait and square art floats. Landscape art is composed wide and
          becomes an unreadable stamp at 15rem, so it runs as a banner below the
          header instead — see the note in `entity-image`.
        */}
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
              {/* The book by name, not by abbreviation — "PHB" is jargon a
                reader has to already know to get anything from. */}
              <Box asChild _hover={{ color: "brand" }}>
                <NextLink href={`/sources/${race.sourceId.toLowerCase()}`}>
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

            {/*
              Wide art sits between the name and the stat line, not after it.
              Size and speed are the first thing you read *about* the race, so
              they belong against its traits — dropping the art in between left
              the stat line orphaned above an illustration it had nothing to do
              with.
            */}
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

        {/* Prose before the first named trait — flavour, usually. */}
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

        {/*
          Everything below clears the float, so a tall illustration cannot push
          into the subrace list or leave a lone image stranded beside it.
        */}
        {rest.length > 0 ? (
          <Box clear="both" mb="6">
            <IllustrationRow images={rest} entityName={race.name} />
          </Box>
        ) : null}

        {/*
          The bodies are built here, on the server — they resolve
          cross-references against the database, so they cannot be built in the
          browser — and handed to the list as props.
        */}
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

        {/*
          Attribution in one place at the foot of the page.

          It used to be a caption inside the figure, which for a floated
          illustration meant it surfaced wherever the float happened to end —
          an artist's name stranded halfway through an unrelated trait.
        */}
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
 * A subrace as the disclosure list wants it.
 *
 * The book is named in full and on every row. Named, because "MTF" tells a
 * reader nothing about where Duergar came from; on every row, because in one
 * consolidated list the book is the only thing distinguishing a PHB option from
 * one a later supplement added.
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
 * Split the corpus's flat entry list into an intro and named sections.
 *
 * Only the top level is split. Anything deeper is left to the renderer, which
 * already handles nesting — the point here is just to produce something the
 * outline can address, and only top-level traits are worth a jump target.
 */
function splitSections(entries: Entry[] | undefined) {
  const intro: Entry[] = [];
  const sections: { id: string; title: string; entries: Entry[] }[] = [];
  const used = new Set<string>();

  for (const entry of entries ?? []) {
    const named =
      typeof entry === "object" &&
      entry !== null &&
      "name" in entry &&
      typeof entry.name === "string" &&
      entry.name.trim();

    if (!named) {
      intro.push(entry);
      continue;
    }

    const title = (entry as { name: string }).name;
    sections.push({
      id: uniqueAnchor(title, used),
      title,
      entries: ((entry as { entries?: Entry[] }).entries ?? []) as Entry[],
    });
  }

  return { intro, sections };
}

/**
 * A local, in-page anchor.
 *
 * Safe to derive here, unlike an entity slug — this addresses a heading within
 * one document rather than a row in the database, so nothing downstream depends
 * on it matching what ingest produced.
 */
function uniqueAnchor(text: string, used: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";

  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

/**
 * Why this page is reachable but not listed.
 *
 * These races are excluded from the races index, so anyone standing here
 * arrived by URL, search or bookmark rather than by browsing. Saying nothing
 * would read as an oversight — the page looks like any other race — and hiding
 * it outright would 404 a race the books really do print.
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

/** The three values a player checks first, before reading anything. */
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

/**
 * A subrace's contents, without any header of its own — the accordion's trigger
 * is the header, so repeating the name here would print it twice.
 */
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
