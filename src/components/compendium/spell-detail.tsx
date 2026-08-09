import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { Entries } from "@/components/entry";
import type { ReferenceIndex } from "@/lib/content/references";
import { sourceHref } from "@/lib/routes";
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
 * A spell, rendered in full. Used by both the spell page and the browse aside,
 * which share a URL and so must not drift.
 *
 * `density` changes measurements only, never content.
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
  /** "aside" is the 400px column; "page" is the full-width route. */
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

      {/* The four lines every spell leads with, in their printed order. */}
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

/** Book and page number, for readers following along in print. */
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
        <NextLink href={sourceHref(sourceId)} title={sourceName}>
          {sourceId}
        </NextLink>
      </Box>
      {page ? ` · p. ${page}` : null}
    </Text>
  );
}

/**
 * A label/value pair. Label in the UI face, value in the body face, so the
 * app's own text and the book's text stay visually distinct.
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
 * What else mentions this spell. Grouped by entity type and shown as links
 * rather than a count — Fireball alone has 224 inbound references.
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
                      color="reference"
                      textDecoration="underline"
                      textDecorationColor="reference.line"
                      textUnderlineOffset="2px"
                      _hover={{ textDecorationColor: "reference" }}
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
