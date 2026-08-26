import { Box, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { openEntityAside } from "@/app/aside-actions";
import { AsideLinks } from "@/components/compendium/aside-links";
import {
  fluffImages,
  IllustrationBanner,
  IllustrationPlate,
  IllustrationRow,
  imageCredits,
  isLandscape,
} from "@/components/compendium/entity-image";
import {
  OutlineNav,
  type OutlineItem,
} from "@/components/compendium/outline-nav";
import { SubraceList } from "@/components/compendium/subrace-accordion";
import { TraitSummary } from "@/components/compendium/trait-summary";
import { Entries, Inline, type Entry } from "@/components/entry";
import { ReadingColumn } from "@/components/layout";
import { subjectSide } from "@/lib/content/media";
import { splitSections } from "@/lib/content/outline";
import { entriesOf, formatSize, formatSpeed } from "@/lib/content/races";
import { collectReferences } from "@/lib/content/references";
import { sourceHref } from "@/lib/routes";
import { resolveReferences } from "@/server/db/queries/references";
import { getRace, type SubraceDetail } from "@/server/db/queries/races";

/**
 * One race, as a reading page: a measured column with a section outline, like a
 * book chapter. Clicking a race navigates here; there is no aside.
 *
 * Subrace sections are anchored on the subrace's slug, which is what `hrefFor`
 * produces for a fragment (`/compendium/races/phb/dwarf#hill`). The ids here
 * and the resolver must agree or inbound links land in the wrong place.
 *
 * A slug is unique per source rather than per parent, so it is an anchor and
 * not a key. Both subrace lists are keyed on the natural key instead.
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

  /*
   * The book's flavour text, which the books keep in fluff rather than in the
   * race's own entries: of the 134 races, 98 carry prose only there, and their
   * `data.entries` are nothing but named traits. Without this, most race pages
   * open straight into "Flight" with nothing to say what an aarakocra is — and
   * the aside, which does read fluff, ended up saying more about a race than
   * its own page did.
   *
   * Added to the race's own opening rather than replacing it. Four races carry
   * a line of their own as well, and it is a rules note rather than a second
   * telling of the flavour.
   */
  const opening = [
    ...splitSections<Entry>(entriesOf<Entry>(race.fluff)).intro,
    ...intro,
  ];

  // 111 of 134 races have illustrations, so this has to handle none. Subraces
  // are skipped: none have images, despite 68 claiming `hasFluffImages`.
  const images = fluffImages(race.fluff);
  const [art, ...rest] = images;
  const credits = imageCredits(images);

  /*
   * The same two treatments the class pages use, and for the same reason.
   *
   * A standing figure goes out into the top corner of the page, whole and at
   * size, where it costs the prose nothing. Which corner is the picture's own
   * business: art whose figure stands against the left of its frame takes the
   * right corner and the rest take the left, so the figure faces across the
   * page rather than off the edge of it.
   *
   * It floated inside the column before, which worked while a race page opened
   * with a line or two. Now that the flavour text is printed the pages run
   * long, and a floated portrait either strands a column of two-word lines
   * beside it or — for the several plates that are mostly transparent padding —
   * pushes the opening paragraphs down the page for no visible reason. Out in
   * the margin the art can be any shape it likes.
   *
   * Wide art has no corner to stand in and still runs as a banner.
   */
  const banner = art && isLandscape(art) ? art : undefined;
  const plate = art && !banner ? art : undefined;
  const plateSide = subjectSide(plate) === "left" ? "right" : "left";

  // One resolve for the whole page, parent and subraces together — otherwise
  // a Tiefling page would make fourteen round trips to build its links.
  const refs = await resolveReferences(
    collectReferences([
      race.data,
      // The flavour text is rendered too, and its tags need resolving with the
      // rest — a fluff paragraph cites spells and creatures like any other.
      race.fluff,
      ...race.subraces.map((s) => s.data),
    ]),
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
            listKey: sub.naturalKey,
            label: sub.name,
            depth: 1 as const,
          })),
        ]
      : []),
  ];

  return (
    <ReadingColumn
      outline={outline.length > 0 ? <OutlineNav items={outline} /> : undefined}
      plate={
        plate ? (
          <IllustrationPlate
            image={plate}
            entityName={race.name}
            side={plateSide}
            priority
          />
        ) : undefined
      }
      plateSide={plateSide}
    >
      {/*
        Wrapped so cross-references open beside the page instead of leaving it:
        a race's traits are thick with them — a Duergar alone cites four spells
        — and following one used to cost the race you were reading.

        Spacing is carried on the blocks rather than a Stack gap.
      */}
      <AsideLinks load={openEntityAside}>
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
            {banner ? (
              <Box mt="4">
                <IllustrationBanner
                  image={banner}
                  entityName={race.name}
                  priority
                />
              </Box>
            ) : null}

            {/* The corner plate itself at the widths that have no margin to
                stand it in, where showing it this way beats not showing it. */}
            {plate ? (
              <Box display={{ base: "block", lg: "none" }} mt="4">
                <IllustrationBanner
                  image={plate}
                  entityName={race.name}
                  maxHeight={300}
                />
              </Box>
            ) : null}

            <TraitSummary race={race} />
          </Box>
        </Box>

        {race.isNpcRace ? <NpcRaceNote /> : null}

        {/* Prose before the first named trait. */}
        {opening.length > 0 ? (
          <Box mb="6">
            <Entries
              entries={opening}
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

        {rest.length > 0 ? (
          <Box mb="6">
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

        {/* Attribution collected here rather than captioned on each figure. */}
        {credits.length > 0 ? (
          <Box
            as="section"
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
      </AsideLinks>
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
    listKey: sub.naturalKey,
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
