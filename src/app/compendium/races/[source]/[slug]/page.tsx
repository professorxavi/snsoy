import { Box, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { OutlineNav, type OutlineItem } from "@/components/compendium/outline-nav";
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

  // One resolve for the whole page, parent and subraces together — otherwise
  // a Tiefling page would make fourteen round trips to build its links.
  const refs = await resolveReferences(
    collectReferences([race.data, ...race.subraces.map((s) => s.data)]),
  );

  /**
   * Subraces split by which book printed them.
   *
   * 48 of the corpus's 93 subraces appear in a *different* book from their
   * parent race — MTF adds Duergar to the PHB dwarf, Eberron adds the
   * dragonmarks. They belong on this page, because they genuinely are subraces
   * of this race, but presenting them unlabelled under a heading that says
   * "Dwarf · PHB" is how you end up wondering where Mark of Warding came from.
   * Separating them also gives Phase 6 an obvious seam: this second group is
   * precisely what entitlement gating has to hide.
   */
  const native = race.subraces.filter((sub) => sub.sourceId === race.sourceId);
  const fromOthers = race.subraces.filter(
    (sub) => sub.sourceId !== race.sourceId,
  );

  const outline: OutlineItem[] = [
    ...sections.map((section) => ({ id: section.id, label: section.title })),
    ...(native.length > 0
      ? [
          { id: SUBRACES_ID, label: "Subraces" },
          ...native.map((sub) => ({
            id: sub.slug,
            label: sub.name,
            depth: 1 as const,
          })),
        ]
      : []),
    ...(fromOthers.length > 0
      ? [
          { id: OTHER_SUBRACES_ID, label: "From other books" },
          ...fromOthers.map((sub) => ({
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

        {/*
          The bodies are built here, on the server — they resolve
          cross-references against the database, so they cannot be built in the
          browser — and handed to the list as props.
        */}
        {native.length > 0 ? (
          <Box as="section" id={SUBRACES_ID} scrollMarginTop="4rem">
            <SectionHeading>Subraces</SectionHeading>
            <SubraceList
              items={native.map((sub) =>
                toItem(sub, refs, race.name, { showSource: false }),
              )}
            />
          </Box>
        ) : null}

        {fromOthers.length > 0 ? (
          <Box as="section" id={OTHER_SUBRACES_ID} scrollMarginTop="4rem">
            <SectionHeading>From other books</SectionHeading>
            <Text
              className="prose"
              fontFamily="body"
              fontSize="sm"
              lineHeight="1.6"
              color="fg.muted"
              mb="2"
            >
              Later books add these to the {race.name.toLowerCase()}.
            </Text>
            <SubraceList
              items={fromOthers.map((sub) =>
                toItem(sub, refs, race.name, { showSource: true }),
              )}
            />
          </Box>
        ) : null}
      </Stack>
    </ReadingColumn>
  );
}

const SUBRACES_ID = "subraces";
const OTHER_SUBRACES_ID = "other-subraces";

/**
 * A subrace as the disclosure list wants it.
 *
 * The source abbreviation is only worth printing when it differs from the page
 * you are on — repeating "PHB" down a PHB page is noise, but "MTF" next to
 * Duergar is the whole point.
 */
function toItem(
  sub: SubraceDetail,
  refs: Awaited<ReturnType<typeof resolveReferences>>,
  parentName: string,
  { showSource }: { showSource: boolean },
) {
  const page = sub.page ? `p. ${sub.page}` : "";
  return {
    id: sub.slug,
    name: sub.name,
    meta: [showSource ? sub.sourceId : "", page].filter(Boolean).join(" · "),
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
