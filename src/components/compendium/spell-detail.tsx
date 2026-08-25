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
import type { SpellDetail as SpellDetailData } from "@/server/db/queries/spells";

/**
 * A spell, rendered in full. Used by both the spell page and the browse aside,
 * which share a URL and so must not drift.
 *
 * `density` changes measurements and nothing else: the two render the same
 * document at different sizes. Everything the book prints about a spell appears
 * in both, and nothing that isn't about the spell appears in either.
 */
export function SpellDetail({
  spell,
  refs,
  density = "page",
}: {
  spell: SpellDetailData;
  refs: ReferenceIndex;
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
