import { Box, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { OutlineNav, type OutlineItem } from "@/components/compendium/outline-nav";
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

  // One resolve for the whole page, parent and subraces together — otherwise
  // a Tiefling page would make fourteen round trips to build its links.
  const refs = await resolveReferences(
    collectReferences([race.data, ...race.subraces.map((s) => s.data)]),
  );

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
      <Stack gap="6">
        <Box as="header">
          <Text
            fontFamily="ui"
            fontSize="2xs"
            fontWeight="medium"
            letterSpacing="widest"
            textTransform="uppercase"
            color="fg.subtle"
          >
            <Box asChild _hover={{ color: "brand" }}>
              <NextLink
                href={`/sources/${race.sourceId.toLowerCase()}`}
                title={race.sourceName}
              >
                {race.sourceId}
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

          <TraitSummary race={race} />
        </Box>

        {/* Prose before the first named trait — flavour, usually. */}
        {intro.length > 0 ? (
          <Entries
            entries={intro}
            refs={refs}
            selfKey={race.naturalKey}
            context={race.name}
          />
        ) : null}

        {sections.map((section) => (
          <Box as="section" key={section.id} id={section.id} scrollMarginTop="4rem">
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

        {race.subraces.length > 0 ? (
          <Box as="section" id={SUBRACES_ID} scrollMarginTop="4rem">
            <SectionHeading>Subraces</SectionHeading>
            <Stack gap="7">
              {race.subraces.map((sub) => (
                <Subrace
                  key={sub.id}
                  subrace={sub}
                  refs={refs}
                  parentName={race.name}
                />
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </ReadingColumn>
  );
}

const SUBRACES_ID = "subraces";

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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text
      as="h2"
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
function TraitSummary({ race }: { race: RaceDetail | SubraceDetail }) {
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
      gap="x-4"
      columnGap="5"
      rowGap="1"
      mt="3"
      pt="3"
      borderTopWidth="1px"
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

function Subrace({
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
    <Box id={subrace.slug} scrollMarginTop="4rem">
      <Text
        as="h3"
        fontFamily="body"
        fontWeight="semibold"
        fontSize="md"
        lineHeight="1.3"
      >
        {subrace.name}
        {subrace.sourceId !== undefined ? (
          <Text
            as="span"
            fontFamily="ui"
            fontSize="2xs"
            fontWeight="normal"
            letterSpacing="wide"
            color="fg.subtle"
            ml="2"
          >
            {subrace.sourceId}
            {subrace.page ? ` · p. ${subrace.page}` : null}
          </Text>
        ) : null}
      </Text>

      <TraitSummary race={subrace} />

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
