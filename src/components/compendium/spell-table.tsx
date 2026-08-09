import { Box, Table, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { AsideLink } from "@/components/compendium/aside-link";
import { asideKey } from "@/lib/aside";
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
import type { SpellRow, SpellSort } from "@/server/db/queries/spells";

/**
 * The spell list, as a dense comparison table.
 *
 * Columns marked `optional` drop out when the aside opens, which leaves the
 * table around 500px.
 *
 * Stays a server component. Only the name in each row is a client component,
 * and `open` is bound to each row here rather than imported — a shared
 * component has no business importing a route's action, and doing so would drag
 * the database client into every test that renders a table.
 */

export function SpellTable({
  rows,
  params,
  open,
}: {
  rows: SpellRow[];
  params: QueryParams;
  /** Renders one spell for the aside. The route supplies its server function. */
  open: (source: string, slug: string) => Promise<ReactNode>;
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
            <SpellRowView key={row.id} row={row} open={open} />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}

function SpellRowView({
  row,
  open,
}: {
  row: SpellRow;
  open: (source: string, slug: string) => Promise<ReactNode>;
}) {
  const href = hrefFor({
    entityType: "spell",
    sourceId: row.sourceId,
    slug: row.slug,
  });

  return (
    <Table.Row position="relative">
      <Cell fontWeight="medium">
        {/*
          One anchor stretched over the whole row by a pseudo-element, rather
          than a link per cell — nine identical links per row is unusable with a
          keyboard or screen reader.

          The row's tint follows the anchor's `aria-current` through a `:has()`
          rule in `BrowseFrame`, so the selection needs no prop and this stays a
          server component.
        */}
        <Box
          asChild
          color="fg"
          _after={{ content: '""', position: "absolute", inset: 0 }}
          _hover={{ color: "brand" }}
        >
          <AsideLink
            href={href ?? "#"}
            // Built the same way the reader's links build theirs, so a spell
            // opened from a chapter and the same spell opened from this table
            // are one entry in the cache and one selected row, not two.
            entityKey={asideKey("spell", row.sourceId, row.slug)}
            label={row.name}
            load={open.bind(null, row.sourceId, row.slug)}
          >
            {row.name}
          </AsideLink>
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
 * Duration, minus the "Concentration, up to" prefix — the row already carries a
 * C marker beside the name.
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

/** Columns the browse frame's CSS hides while the aside is open. */
const OPTIONAL_ATTR = { "data-col-optional": "" };

function Header({
  children,
  optional,
  numeric,
  sorted,
}: {
  children: ReactNode;
  optional?: boolean;
  numeric?: boolean;
  /** Announced on the header cell itself, which is where `aria-sort` belongs. */
  sorted?: boolean;
}) {
  return (
    <Table.ColumnHeader
      {...(optional ? OPTIONAL_ATTR : {})}
      aria-sort={sorted ? "ascending" : undefined}
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
  sort: SpellSort;
  numeric?: boolean;
  children: ReactNode;
}) {
  const active = (params["sort"] ?? "name") === sort;

  return (
    <Header numeric={numeric} sorted={active}>
      <Box
        asChild
        color={active ? "brand" : "inherit"}
        _hover={{ color: "brand" }}
      >
        <NextLink href={`/compendium/spells${withValue(params, "sort", sort)}`}>
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

/** A one-letter flag; the title attribute spells it out. */
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
