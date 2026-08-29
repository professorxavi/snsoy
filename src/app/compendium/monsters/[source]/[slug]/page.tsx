import { Box, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideLinks } from "@/components/compendium/aside-links";
import {
  fluffImages,
  IllustrationBanner,
  IllustrationPlate,
  IllustrationRow,
  imageCredits,
  isLandscape,
  TokenPortrait,
} from "@/components/compendium/entity-image";
import {
  MonsterStatblock,
  StatblockHeading,
} from "@/components/compendium/monster-statblock";
import {
  OutlineNav,
  type OutlineItem,
} from "@/components/compendium/outline-nav";
import { Entries, Inline, type Entry } from "@/components/entry";
import { ReadingColumn } from "@/components/layout";
import { subjectSide, tokenPath } from "@/lib/content/media";
import {
  formatChallenge,
  formatCreatureLine,
  formatEnvironmentList,
  type AlignmentEntry,
  type ChallengeRating,
  type CreatureType,
} from "@/lib/content/monsters";
import { splitSections } from "@/lib/content/outline";
import { collectReferences } from "@/lib/content/references";
import { sourceHref } from "@/lib/routes";
import { getMonster } from "@/server/db/queries/monsters";
import { resolveReferences } from "@/server/db/queries/references";

/**
 * One creature, as a reading page: the stat block, its artwork and its lore.
 *
 * The stat block leads. A reader who opened a creature cold wants the numbers,
 * and several hundred pixels of prose above the armour class would repeat the
 * mistake the aside was careful to avoid. The lore follows it, which is also
 * the order the books use.
 *
 * Creatures were the largest body of content with no page of their own — 3,628
 * of them, addressed by `hrefFor` and linked from every browse row, every
 * search result and all 15,887 `{@creature}` tags in book text. The aside
 * answered for them in 400px, with no room for the 2,503 illustrations and
 * 2,517 pieces of lore that rendered nowhere at all.
 *
 * **No "Referenced by" section, now or later.** A creature is cited from
 * thousands of places, and a wall of links naming them answers a question about
 * the books rather than about the creature.
 */

interface RouteParams {
  params: Promise<{ source: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { source, slug } = await params;
  const monster = await getMonster(source, slug);

  if (!monster) return { title: "Not found" };

  const data = monster.data as CreatureData;
  const summary = [
    formatCreatureLine(data),
    `Challenge ${formatChallenge(data.cr ?? monster.crDisplay)}`,
  ].filter(Boolean);

  return {
    // "Creatures" rather than "Monsters", matching the list page's own title.
    title: `${monster.name} · Creatures`,
    description: `${summary.join(". ")}. ${monster.sourceName}${
      monster.page ? `, p. ${monster.page}` : ""
    }.`,
  };
}

export default async function MonsterPage({ params }: RouteParams) {
  const { source, slug } = await params;
  const monster = await getMonster(source, slug);

  if (!monster) notFound();

  const data = monster.data as CreatureData;
  const fluff = monster.fluff as { entries?: Entry[] } | null;

  /*
   * The lore, read straight off `fluff.entries`.
   *
   * Unlike a race there is no second source to merge: a creature has no
   * `data.entries` at all, so everything it says about itself in prose is
   * here. 2,517 of the 3,628 have some; 529 of those carry a named section.
   */
  const { intro, sections } = splitSections<Entry>(fluff?.entries);

  /*
   * One resolve for the whole page, the stat block and the lore together.
   *
   * The aside resolves `data` alone because it prints the block and nothing
   * else. This page prints the lore and the lair too, and both cite spells and
   * creatures like any other text — an aboleth's lair action casts
   * {@spell phantasmal force} — so resolving them separately would mean three
   * round trips for one document.
   */
  const refs = await resolveReferences(
    collectReferences([monster.data, monster.fluff, monster.lair]),
  );

  const images = fluffImages(monster.fluff);
  const [art, ...rest] = images;
  const credits = imageCredits(images);

  /*
   * The same two treatments the race and class pages use. A standing figure
   * goes out into the top corner of the page, whole and at size, where it costs
   * the prose nothing; wide art has no corner to stand in and runs as a banner.
   */
  const banner = art && isLandscape(art) ? art : undefined;
  const plate = art && !banner ? art : undefined;
  const plateSide = subjectSide(plate) === "left" ? "right" : "left";

  /*
   * The 1,125 creatures with no illustration get their map token instead —
   * every one of them has a token file, with no misses across the whole set.
   *
   * In normal flow rather than in the plate slot: a token is 280x280, so at the
   * plate's 24–30rem it would be upscaled several times over, and sitting in
   * flow means it needs none of the plate's masking or its small-viewport
   * duplicate.
   */
  const token = art
    ? undefined
    : // Stored only when the creature was merged into a containing book, whose
      // id is not the one its token is filed under.
      (typeof data.token === "string" ? data.token : null) ??
      tokenPath("monster", monster.name, monster.sourceId);

  const environment = formatEnvironmentList(data.environment);

  /*
   * Outlined only when the lore contributes a named section, as the race page
   * does. Roughly 1,988 of the 2,517 creatures with lore have prose only, and
   * those get the full-width column rather than a nav pointing at one thing.
   *
   * The stat block's own headings are deliberately not outlined: `Block` emits
   * no ids, and giving it them is a larger change than this page needs.
   */
  const outline: OutlineItem[] = sections.map((section) => ({
    id: section.id,
    label: section.title,
  }));

  /* Both shapes count: 1,988 of the creatures with lore have prose and no
     named section, and a few carry sections with no prose above them. */
  const hasLore = intro.length > 0 || sections.length > 0;

  /*
   * The lair, in the order the books print it. Only the parts a group actually
   * carries: of the 144 groups, 24 have lair actions and no regional effects,
   * 23 the reverse, and six have neither — five of those being hags whose
   * upstream `_copy` inheritance ingest never resolved, which is why a resolved
   * group is still not a guarantee of anything to show.
   */
  const lair = [
    { heading: "Lair Actions", entries: entryList(monster.lair, "lairActions") },
    { heading: "Regional Effects", entries: entryList(monster.lair, "regionalEffects") },
    { heading: "Mythic Encounter", entries: entryList(monster.lair, "mythicEncounter") },
  ].filter((section) => section.entries.length > 0);

  return (
    <ReadingColumn
      outline={outline.length > 0 ? <OutlineNav items={outline} /> : undefined}
      plate={
        plate ? (
          <IllustrationPlate
            image={plate}
            entityName={monster.name}
            side={plateSide}
            priority
          />
        ) : undefined
      }
      plateSide={plateSide}
    >
      {/*
        Wrapped so the block's own cross-references — the spell that raises an
        AC, the creature it summons — open beside the page instead of leaving
        it, in the drawer this route's own layout provides.
      */}
      <AsideLinks load={openEntityAside}>
        <Box as="header" mb="6">
          <Text
            fontFamily="ui"
            fontSize="2xs"
            fontWeight="medium"
            letterSpacing="widest"
            textTransform="uppercase"
            color="fg.subtle"
          >
            <Box asChild _hover={{ color: "brand" }}>
              <NextLink href={sourceHref(monster.sourceId)}>
                {monster.sourceName}
              </NextLink>
            </Box>
            {monster.page ? ` · p. ${monster.page}` : null}
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
            {monster.name}
          </Text>

          {banner ? (
            <Box mt="4">
              <IllustrationBanner
                image={banner}
                entityName={monster.name}
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
                entityName={monster.name}
                maxHeight={300}
              />
            </Box>
          ) : null}

          {token ? (
            <Box mt="4">
              <TokenPortrait path={token} entityName={monster.name} />
            </Box>
          ) : null}
        </Box>

        {/* The numbers first, which is what a creature is opened for. */}
        <Box mb="6">
          <MonsterStatblock monster={monster} refs={refs} />
        </Box>

        {/*
          What the creature does on its own ground, which the books print beside
          the block and this app showed nowhere.
          
          Above the lore rule on purpose: these are mechanics a DM reads mid
          encounter, and putting them below it would file them as narrative —
          the exact confusion the rule was drawn to remove. They are headed in
          the block's own voice for the same reason.

          Stored on a legendary group rather than on the creature, because a
          lair is shared: every adult and ancient black dragon reads the same
          one. `getMonster` resolves it by the key the creature names.
        */}
        {lair.map((section) => (
          <Box as="section" key={section.heading} mb="6">
            <StatblockHeading>{section.heading}</StatblockHeading>
            <Entries
              entries={section.entries}
              refs={refs}
              selfKey={monster.naturalKey}
              context={monster.name}
            />
          </Box>
        ))}

        {/*
          Where the creature stops being numbers and starts being writing.
          Until this had an opener the two met at a gap: the last action and the
          first line of lore share Literata at the same size, colour and
          measure, so on a phone they read as consecutive paragraphs of one
          thing, and a reader looking something up mid-play could not tell where
          the reference ended.

          Three signals rather than one, because any of them can be the one a
          given reader has: the space, the rule and the word. Colour is the
          least of them — the boundary has to survive greyscale and forced
          colours, so cyan supplies the character and carries none of the
          meaning. Cyan and not purple because what follows is the book
          speaking, and purple is this application speaking.
        */}
        {hasLore ? (
          <Box as="section" aria-labelledby={LORE_HEADING_ID} mt="10">
            <Box borderTopWidth="2px" borderColor="reference" pt="2" mb="4">
              <Text
                as="h2"
                id={LORE_HEADING_ID}
                fontFamily="ui"
                fontSize="2xs"
                fontWeight="semibold"
                letterSpacing="widest"
                textTransform="uppercase"
                color="fg.muted"
              >
                Lore
              </Text>
            </Box>

            {intro.length > 0 ? (
              <Box mb="6">
                <Entries
                  entries={intro}
                  refs={refs}
                  selfKey={monster.naturalKey}
                  context={monster.name}
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
                {/*
                  A step down now that they sit under `Lore`, and only that: the
                  size, rule and ids are the ones the outline and every inbound
                  anchor already point at.
                */}
                <SectionHeading level={3}>
                  <Inline text={section.title} refs={refs} context={monster.name} />
                </SectionHeading>
                <Entries
                  entries={section.entries}
                  refs={refs}
                  selfKey={monster.naturalKey}
                  context={monster.name}
                />
              </Box>
            ))}
          </Box>
        ) : null}

        {rest.length > 0 ? (
          <Box mb="6">
            <IllustrationRow images={rest} entityName={monster.name} />
          </Box>
        ) : null}

        {/* Where it is found. Book-external metadata rather than part of the
            printed block, so it sits at the foot beside the credits. */}
        {environment ? (
          <FootNote label="Environment">{environment}</FootNote>
        ) : null}

        {credits.length > 0 ? (
          <FootNote label="Art credits">{credits.join(" · ")}</FootNote>
        ) : null}

        {/* And nothing after this. No "Referenced by" — see the note above. */}
      </AsideLinks>
    </ReadingColumn>
  );
}

/**
 * One of a legendary group's entry arrays, if it is there and is one.
 *
 * Guarded rather than cast: a group is stored as an opaque blob, six of the 144
 * carry neither list, and the shape is upstream's rather than ours.
 */
function entryList(lair: unknown, field: string): Entry[] {
  if (!lair || typeof lair !== "object") return [];
  const value = (lair as Record<string, unknown>)[field];
  return Array.isArray(value) ? (value as Entry[]) : [];
}

/** What this page reads off the creature's blob, beyond what the block takes. */
interface CreatureData {
  size?: string[];
  type?: string | CreatureType;
  alignment?: AlignmentEntry[];
  alignmentPrefix?: string;
  cr?: ChallengeRating;
  environment?: unknown;
  /** Set by ingest only for a creature merged into a containing book. */
  token?: string;
}

/**
 * A small labelled line at the foot of the page — the same visual language for
 * everything that is *about* the page rather than in it.
 */
function FootNote({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Box as="section" mt="10" pt="4" borderTopWidth="1px" borderColor="border">
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
        {label}
      </Text>
      <Text fontFamily="body" fontSize="sm" color="fg.muted">
        {children}
      </Text>
    </Box>
  );
}

/** The id the lore wrapper is named by, shared by both ends of that pairing. */
const LORE_HEADING_ID = "monster-lore-heading";

function SectionHeading({
  children,
  level = 2,
}: {
  children: ReactNode;
  /** Only the element changes. A lore heading looks the same at either. */
  level?: 2 | 3;
}) {
  return (
    <Text
      as={`h${level}`}
      // `flow-root` so the rule under the heading does not run behind the
      // floated plate — see the race page, where the same thing bit.
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
