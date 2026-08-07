import { Box, Table, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import {
  componentLetters,
  formatCastingTime,
  formatClassList,
  formatRange,
  levelShort,
  schoolName,
} from "@/lib/content/spells";
import { withValue, type QueryParams } from "@/lib/query-params";
import { hrefFor } from "@/lib/routes";
import type { SpellRow } from "@/server/db/queries/spells";

/**
 * The spell list.
 *
 * A dense table rather than roomy cards, because browsing 525 spells is a
 * *comparison* task — you are scanning down a column for a 1st-level bard spell
 * with a bonus-action cast, not reading each entry in turn. Cards make that
 * scan impossible by putting every value in a different place on every row.
 *
 * Four columns are marked optional and drop out when the aside opens. That is
 * the measured cost of the pattern: a 400px aside plus a rail leaves the table
 * about 500px, and Duration, Components and Classes are the values you are
 * least likely to be comparing at the moment you have opened one spell to read.
 */

export function SpellTable({
  rows,
  params,
  selectedSlug,
}: {
  rows: SpellRow[];
  params: QueryParams;
  /** Slug of the spell currently open, so its row reads as selected. */
  selectedSlug?: string;
}) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <Box overflowX="auto">
      <Table.Root size="sm" interactive stickyHeader>
        <Table.Header>
          <Table.Row bg="bg.muted">
            <SortableHeader params={params} sort="name">
              Name
            </SortableHeader>
            <SortableHeader params={params} sort="level" numeric>
              Lvl
            </SortableHeader>
            <Header>School</Header>
            <Header>Casting time</Header>
            <Header>Range</Header>
            <Header optional>Components</Header>
            <Header optional>Duration</Header>
            <Header optional>Classes</Header>
            <Header>Source</Header>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {rows.map((row) => (
            <SpellRowView
              key={row.id}
              row={row}
              selected={row.slug === selectedSlug}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}

function SpellRowView({ row, selected }: { row: SpellRow; selected: boolean }) {
  const href = hrefFor({
    entityType: "spell",
    sourceId: row.sourceId,
    slug: row.slug,
  });

  return (
    <Table.Row
      position="relative"
      bg={selected ? "brand.subtle" : undefined}
      aria-current={selected ? "true" : undefined}
    >
      <Cell fontWeight="medium">
        {/*
          One anchor, stretched over the whole row by a pseudo-element. Wrapping
          every cell in its own link would put nine identical links on one row
          for anyone tabbing or using a screen reader.
        */}
        <Box
          asChild
          color="fg"
          _after={{ content: '""', position: "absolute", inset: 0 }}
          _hover={{ color: "brand" }}
        >
          <NextLink href={href ?? "#"} scroll={false}>
            {row.name}
          </NextLink>
        </Box>
        {row.isConcentration ? <Marker title="Concentration">C</Marker> : null}
        {row.isRitual ? <Marker title="Ritual">R</Marker> : null}
      </Cell>

      <Cell numeric>{levelShort(row.level)}</Cell>
      <Cell>{schoolName(row.school)}</Cell>
      <Cell>{formatCastingTime(row.time ?? undefined)}</Cell>
      <Cell>{formatRange(row.range)}</Cell>
      <Cell optional>{componentLetters(row.components)}</Cell>
      <Cell optional>{formatDurationShort(row)}</Cell>
      <Cell optional muted>
        {formatClassList(row.classes)}
      </Cell>
      <Cell muted>{row.sourceId}</Cell>
    </Table.Row>
  );
}

/**
 * Duration, minus the "Concentration, up to" prefix.
 *
 * The row already carries a C marker beside the name, so repeating the word in
 * every duration cell would cost a third of the column's width to say nothing.
 */
function formatDurationShort(row: SpellRow): string {
  const durations = row.duration;
  if (!durations?.length) return "—";

  const first = durations[0];
  if (first.type === "instant") return "Instant";
  if (first.type === "permanent") return "Until dispelled";
  if (first.type === "special") return "Special";

  const value = first.duration;
  if (!value) return "—";

  const unit = value.amount === 1 ? value.type : `${value.type}s`;
  return `${value.amount} ${unit}`;
}

/** Optional columns are hidden by the frame's CSS when the aside is open. */
const OPTIONAL_ATTR = { "data-col-optional": "" };

function Header({
  children,
  optional,
  numeric,
}: {
  children: ReactNode;
  optional?: boolean;
  numeric?: boolean;
}) {
  return (
    <Table.ColumnHeader
      {...(optional ? OPTIONAL_ATTR : {})}
      fontFamily="ui"
      fontSize="2xs"
      fontWeight="semibold"
      letterSpacing="wide"
      textTransform="uppercase"
      color="fg.subtle"
      whiteSpace="nowrap"
      textAlign={numeric ? "end" : undefined}
    >
      {children}
    </Table.ColumnHeader>
  );
}

function SortableHeader({
  params,
  sort,
  numeric,
  children,
}: {
  params: QueryParams;
  sort: "name" | "level";
  numeric?: boolean;
  children: ReactNode;
}) {
  const active = (params["sort"] ?? "name") === sort;

  return (
    <Header numeric={numeric}>
      <Box
        asChild
        color={active ? "brand" : "inherit"}
        _hover={{ color: "brand" }}
      >
        <NextLink
          href={`/compendium/spells${withValue(params, "sort", sort)}`}
          aria-sort={active ? "ascending" : undefined}
        >
          {children}
          {active ? " ↓" : null}
        </NextLink>
      </Box>
    </Header>
  );
}

function Cell({
  children,
  optional,
  numeric,
  muted,
  fontWeight,
}: {
  children: ReactNode;
  optional?: boolean;
  numeric?: boolean;
  muted?: boolean;
  fontWeight?: string;
}) {
  return (
    <Table.Cell
      {...(optional ? OPTIONAL_ATTR : {})}
      fontFamily="ui"
      fontSize="xs"
      fontWeight={fontWeight}
      color={muted ? "fg.subtle" : "fg.muted"}
      whiteSpace="nowrap"
      textAlign={numeric ? "end" : undefined}
      fontVariantNumeric={numeric ? "tabular-nums" : undefined}
    >
      {children}
    </Table.Cell>
  );
}

/** A one-letter flag. Title carries the word for anyone who needs it. */
function Marker({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Text
      as="abbr"
      title={title}
      ml="1.5"
      fontSize="2xs"
      fontWeight="semibold"
      color="fg.subtle"
      textDecoration="none"
      cursor="help"
    >
      {children}
    </Text>
  );
}

function EmptyState() {
  return (
    <Box px="6" py="16" textAlign="center">
      <Text fontFamily="body" fontSize="md" color="fg.muted">
        No spells match these filters.
      </Text>
    </Box>
  );
}
