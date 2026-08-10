import { Box, Table, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { AsideLink } from "@/components/compendium/aside-link";
import { asideKey } from "@/lib/aside";
import { formatCreatureType, formatSize } from "@/lib/content/monsters";
import { withValue, type QueryParams } from "@/lib/query-params";
import { hrefFor } from "@/lib/routes";
import type { MonsterRow, MonsterSort } from "@/server/db/queries/monsters";

/**
 * The creature list, as a dense comparison table.
 *
 * The columns are the ones a DM picks a creature by — what it is, how hard it
 * hits back, and where it lives — not everything a stat block holds. The block
 * itself is one click away in the aside, so a column here has to earn its width
 * against being read there instead.
 *
 * Columns marked `optional` drop out when the aside opens, which leaves the
 * table around 500px.
 *
 * Stays a server component. Only the name in each row is a client component,
 * and `open` is bound to each row here rather than imported — a shared
 * component has no business importing a route's action, and doing so would drag
 * the database client into every test that renders a table.
 */

export function MonsterTable({
  rows,
  params,
  open,
}: {
  rows: MonsterRow[];
  params: QueryParams;
  /** Renders one creature for the aside. The route supplies its function. */
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
            <SortableHeader params={params} sort="cr" numeric>
              CR
            </SortableHeader>
            <Header>Type</Header>
            <Header>Size</Header>
            <Header numeric>AC</Header>
            <Header numeric>HP</Header>
            <Header optional>Environment</Header>
            <Header>Source</Header>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {rows.map((row) => (
            <MonsterRowView key={row.id} row={row} open={open} />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}

function MonsterRowView({
  row,
  open,
}: {
  row: MonsterRow;
  open: (source: string, slug: string) => Promise<ReactNode>;
}) {
  const href = hrefFor({
    entityType: "monster",
    sourceId: row.sourceId,
    slug: row.slug,
  });

  return (
    <Table.Row position="relative">
      <Cell fontWeight="medium">
        {/*
          One anchor stretched over the whole row by a pseudo-element, rather
          than a link per cell — eight identical links per row is unusable with
          a keyboard or screen reader.

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
            // Built the same way the reader's links build theirs, so a creature
            // opened from a chapter and the same creature opened from this
            // table are one entry in the cache and one selected row, not two.
            entityKey={asideKey("monster", row.sourceId, row.slug)}
            label={row.name}
            load={open.bind(null, row.sourceId, row.slug)}
          >
            {row.name}
          </AsideLink>
        </Box>
        {row.isLegendary ? <Marker title="Legendary">L</Marker> : null}
        {row.isSpellcaster ? <Marker title="Spellcaster">S</Marker> : null}
      </Cell>

      {/* The printed rating, not the sortable number: "1/4", never 0.25. */}
      <Cell numeric>{row.crDisplay ?? "—"}</Cell>
      <Cell>{formatCreatureType(row.creatureType) || "—"}</Cell>
      <Cell>{formatSize(row.sizes) || "—"}</Cell>
      <Cell numeric>{row.armorClass ?? "—"}</Cell>
      <Cell numeric>{row.hitPointsAverage ?? "—"}</Cell>
      <Cell optional muted>
        {formatEnvironments(row.environments)}
      </Cell>
      <Cell muted>{row.sourceId}</Cell>
    </Table.Row>
  );
}

/**
 * How many environments the corpus uses in total. A creature tagged with more
 * than half of them is not a creature of those places, it is a creature of
 * anywhere — which is what most of the named NPCs are.
 */
const ENVIRONMENT_COUNT = 11;

/**
 * Where a creature lives, in a column's worth of space.
 *
 * Three cases, because listing them plainly gets all three wrong. A creature
 * with none would print an empty cell; one with eleven would set the column's
 * width for the three thousand rows that have one or none; and one with seven
 * would print "arctic, desert +5", which reads as an arctic creature and is the
 * opposite of true. The last is the common case among named NPCs, so before
 * this rule dozens of consecutive rows all read "arctic, desert +5".
 */
function formatEnvironments(environments: string[] | null): string {
  if (!environments?.length) return "—";
  if (environments.length > ENVIRONMENT_COUNT / 2) return "any";

  const shown = environments.slice(0, 2).join(", ");
  const rest = environments.length - 2;
  return rest > 0 ? `${shown} +${rest}` : shown;
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
  sort: MonsterSort;
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
        <NextLink href={`/compendium/monsters${withValue(params, "sort", sort)}`}>
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
        No creatures match these filters.
      </Text>
    </Box>
  );
}
