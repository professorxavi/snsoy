import { Box, Table, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { AsideLink } from "@/components/compendium/aside-link";
import { asideKey } from "@/lib/aside";
import { formatItemValue, formatWeight, rarityColumnLabel } from "@/lib/content/items";
import { withValue, type QueryParams } from "@/lib/query-params";
import { hrefFor } from "@/lib/routes";
import type { ItemRow, ItemSort } from "@/server/db/queries/items";

/**
 * The item list, as a dense comparison table.
 *
 * The columns are the ones someone picks an item by — what it is, how rare, and
 * what it costs to carry or buy — not everything an item entry holds. The entry
 * itself is one click away in the aside, so a column here has to earn its width
 * against being read there instead.
 *
 * Rows come from three entity types at once and each links to its own segment,
 * which is what lets one list cover magic items, mundane gear and item groups
 * without merging them in a URL.
 *
 * Columns marked `optional` drop out when the aside opens, which leaves the
 * table around 500px.
 *
 * Stays a server component. Only the name in each row is a client component,
 * and `open` is bound to each row here rather than imported.
 */

export function ItemTable({
  rows,
  params,
  open,
}: {
  rows: ItemRow[];
  params: QueryParams;
  /** Renders one item for the aside. The route supplies its function. */
  open: (type: ItemRow["entityType"], source: string, slug: string) => Promise<ReactNode>;
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
            <Header>Type</Header>
            <SortableHeader params={params} sort="rarity">
              Rarity
            </SortableHeader>
            <SortableHeader params={params} sort="value" numeric>
              Cost
            </SortableHeader>
            <Header optional numeric>
              Weight
            </Header>
            <Header>Source</Header>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {rows.map((row) => (
            <ItemRowView key={row.id} row={row} open={open} />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}

function ItemRowView({
  row,
  open,
}: {
  row: ItemRow;
  open: (type: ItemRow["entityType"], source: string, slug: string) => Promise<ReactNode>;
}) {
  const href = hrefFor({
    entityType: row.entityType,
    sourceId: row.sourceId,
    slug: row.slug,
  });

  return (
    <Table.Row position="relative">
      <Cell fontWeight="medium">
        {/*
          One anchor stretched over the whole row by a pseudo-element, rather
          than a link per cell — six identical links per row is unusable with a
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
            // Built the same way the reader's links build theirs, so an item
            // opened from a chapter and the same item opened from this table
            // are one entry in the cache and one selected row, not two.
            entityKey={asideKey(row.entityType, row.sourceId, row.slug)}
            label={row.name}
            load={open.bind(null, row.entityType, row.sourceId, row.slug)}
          >
            {row.name}
          </AsideLink>
        </Box>
        {row.requiresAttunement ? (
          <Marker title="Requires attunement">A</Marker>
        ) : null}
      </Cell>

      <Cell>{row.typeName ?? "—"}</Cell>
      <Cell>{rarityColumnLabel(row.rarity)}</Cell>
      <Cell numeric>{formatItemValue(row.valueCp)}</Cell>
      <Cell optional numeric muted>
        {formatWeight(row.weightLb)}
      </Cell>
      <Cell muted>{row.sourceId}</Cell>
    </Table.Row>
  );
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
  sort: ItemSort;
  numeric?: boolean;
  children: ReactNode;
}) {
  const active = (params["sort"] ?? "name") === sort;

  return (
    <Header numeric={numeric} sorted={active}>
      <Box asChild color={active ? "brand" : "inherit"} _hover={{ color: "brand" }}>
        <NextLink href={`/compendium/items${withValue(params, "sort", sort)}`}>
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
        No items match these filters.
      </Text>
    </Box>
  );
}
