import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { Entries } from "@/components/entry";
import type { ReferenceIndex } from "@/lib/content/references";
import {
  formatCastingTime,
  formatClassList,
  formatComponents,
  formatDuration,
  formatRange,
  spellSubtitle,
} from "@/lib/content/spells";
import type { Entry } from "@/components/entry";
import type { InboundReference } from "@/server/db/queries/references";
import type { SpellDetail as SpellDetailData } from "@/server/db/queries/spells";

/**
 * A spell, rendered in full.
 *
 * One component for both places a spell is read: its own page and the browse
 * aside. That is not just reuse — the two must not drift, because they are the
 * same URL. Opening a spell from the list intercepts the route rather than
 * replacing it, so a reader who lands cold on a pasted link has to see the same
 * spell the person who sent it was looking at.
 *
 * `density` changes measurements, never content. There is no short version.
 */
export function SpellDetail({
  spell,
  refs,
  inbound,
  density = "page",
}: {
  spell: SpellDetailData;
  refs: ReferenceIndex;
  inbound?: InboundReference[];
  /** "aside" is the 400px column; "page" is the full canonical route. */
  density?: "page" | "aside";
}) {
  const isAside = density === "aside";
  const data = spell.data as {
    entries?: Entry[];
    entriesHigherLevel?: Entry[];
  };

  return (
    <Stack gap={isAside ? "4" : "6"} px={isAside ? "4" : "0"} py={isAside ? "4" : "0"}>
      <Box>
        <SourceLine
          sourceId={spell.sourceId}
          sourceName={spell.sourceName}
          page={spell.page}
        />

        <Text
          as="h1"
          fontFamily="display"
          fontSize={isAside ? "2xl" : { base: "3xl", md: "4xl" }}
          lineHeight="1.05"
          letterSpacing="tight"
          textWrap="balance"
          mt="1"
        >
          {spell.name}
        </Text>

        <Text
          fontFamily="body"
          fontStyle="italic"
          fontSize={isAside ? "sm" : "md"}
          color="fg.muted"
          mt="1"
        >
          {spellSubtitle(spell.level, spell.school)}
          {spell.isRitual ? " (ritual)" : null}
        </Text>
      </Box>

      {/* The four lines every spell card leads with, in their printed order. */}
      <Stack
        gap="1.5"
        borderTopWidth="1px"
        borderBottomWidth="1px"
        borderColor="border"
        py="3"
      >
        <MetaRow label="Casting Time">
          {formatCastingTime(spell.time ?? undefined, { withCondition: true })}
        </MetaRow>
        <MetaRow label="Range">{formatRange(spell.range)}</MetaRow>
        <MetaRow label="Components">
          {formatComponents(spell.components)}
        </MetaRow>
        <MetaRow label="Duration">
          {formatDuration(spell.duration)}
        </MetaRow>
      </Stack>

      <Entries
        entries={data.entries}
        refs={refs}
        selfKey={spell.naturalKey}
        context={spell.name}
      />

      {data.entriesHigherLevel?.length ? (
        <Entries
          entries={data.entriesHigherLevel}
          refs={refs}
          selfKey={spell.naturalKey}
          context={spell.name}
        />
      ) : null}

      {spell.classes?.length ? (
        <Box borderTopWidth="1px" borderColor="border" pt="3">
          <MetaRow label="Classes">{formatClassList(spell.classes)}</MetaRow>
        </Box>
      ) : null}

      {inbound?.length ? <ReferencedBy items={inbound} /> : null}
    </Stack>
  );
}

/**
 * Where the spell is printed.
 *
 * A page number is a number worth keeping: someone with the book open uses it.
 * It is about the content, not about the size of our database.
 */
function SourceLine({
  sourceId,
  sourceName,
  page,
}: {
  sourceId: string;
  sourceName: string;
  page: number | null;
}) {
  return (
    <Text
      fontFamily="ui"
      fontSize="2xs"
      fontWeight="medium"
      letterSpacing="widest"
      textTransform="uppercase"
      color="fg.subtle"
    >
      <Box asChild _hover={{ color: "brand" }}>
        <NextLink href={`/sources/${sourceId.toLowerCase()}`} title={sourceName}>
          {sourceId}
        </NextLink>
      </Box>
      {page ? ` · p. ${page}` : null}
    </Text>
  );
}

/**
 * A label/value pair.
 *
 * The label is set in the UI face and the value in the body face — the label is
 * the app naming a field, the value is the book talking. Keeping the two in
 * different voices is what stops a spell card reading like a form.
 */
function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "1fr", sm: "7.5rem minmax(0, 1fr)" }}
      gap={{ base: "0", sm: "3" }}
      alignItems="baseline"
    >
      <Text
        fontFamily="ui"
        fontSize="2xs"
        fontWeight="semibold"
        letterSpacing="wide"
        textTransform="uppercase"
        color="fg.subtle"
        pt={{ base: "0", sm: "0.5" }}
      >
        {label}
      </Text>
      <Text fontFamily="body" fontSize="sm" lineHeight="1.5">
        {children}
      </Text>
    </Box>
  );
}

/**
 * What else mentions this spell.
 *
 * Deliberately a list and not a tally. The links are useful — the count is
 * corpus trivia, and this product is a game tool rather than a database
 * browser. Grouped by type because 224 undifferentiated names, which is what
 * Fireball actually has, is a wall rather than an index.
 */
function ReferencedBy({ items }: { items: InboundReference[] }) {
  const groups = new Map<string, InboundReference[]>();
  for (const item of items) {
    const existing = groups.get(item.entityType);
    if (existing) existing.push(item);
    else groups.set(item.entityType, [item]);
  }

  return (
    <Box borderTopWidth="1px" borderColor="border" pt="4">
      <Text
        fontFamily="ui"
        fontSize="2xs"
        fontWeight="semibold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="fg.subtle"
        mb="2"
      >
        Referenced by
      </Text>

      <Stack gap="2.5">
        {[...groups].map(([type, group]) => (
          <Box key={type}>
            <Text fontFamily="ui" fontSize="2xs" color="fg.subtle" mb="1">
              {GROUP_LABELS[type] ?? type}
            </Text>
            <Text fontFamily="body" fontSize="sm" lineHeight="1.7">
              {group.map((item, index) => (
                <Box as="span" key={item.id}>
                  {index > 0 ? ", " : null}
                  {item.href ? (
                    <Box
                      asChild
                      color="corpus"
                      textDecoration="underline"
                      textDecorationColor="corpus.line"
                      textUnderlineOffset="2px"
                      _hover={{ textDecorationColor: "corpus" }}
                    >
                      <NextLink href={item.href}>{item.name}</NextLink>
                    </Box>
                  ) : (
                    item.name
                  )}
                </Box>
              ))}
            </Text>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

/** Plural, reader-facing names for the entity types that cite a spell. */
const GROUP_LABELS: Record<string, string> = {
  spell: "Spells",
  monster: "Creatures",
  item: "Items",
  baseitem: "Equipment",
  itemGroup: "Item groups",
  class: "Classes",
  subclass: "Subclasses",
  race: "Races",
  background: "Backgrounds",
  feat: "Feats",
  optionalfeature: "Options",
  bookSection: "Chapters",
  deity: "Deities",
  psionic: "Psionics",
  variantrule: "Rules",
  condition: "Conditions",
  reward: "Rewards",
  vehicle: "Vehicles",
  object: "Objects",
  trap: "Traps",
  hazard: "Hazards",
  charoption: "Character options",
  recipe: "Recipes",
  boon: "Boons",
  cult: "Cults",
  deck: "Decks",
  card: "Cards",
};
