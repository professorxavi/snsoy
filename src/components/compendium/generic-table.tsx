import { Box, Table, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { AsideLink } from "@/components/compendium/aside-link";
import { asideKey } from "@/lib/aside";
import { hrefFor, type BrowsableType } from "@/lib/routes";
import type { GenericListRow } from "@/server/db/queries/generic";

/**
 * The list for a `generic_entities` type, as a dense comparison table.
 *
 * The skills and conditions tables, generalised. A row click opens the entity
 * beside the list rather than navigating away from it, as everywhere else in
 * the compendium, and the columns beyond the name are the only thing that
 * differs between one of these types and the next.
 *
 * Stays a server component. Only the name in each row is a client component,
 * and `open` arrives as a prop rather than an import — a shared component has
 * no business importing a route's action, and doing so would drag the database
 * client into every test that renders a table.
 */

export interface GenericColumn<R> {
  label: string;
  /** Null leaves the cell empty rather than printing a guess. */
  cell: (row: R) => ReactNode;
  /**
   * Shed when the aside opens, through the `:has()` rule in `BrowseFrame`. Use
   * it on the columns a reader can lose while reading one entity — never on the
   * one that answers "which of these do I want", which is the whole reason the
   * list is still on screen.
   */
  optional?: boolean;
  /** For the short columns. A summary line is free to wrap. */
  nowrap?: boolean;
}

const OPTIONAL_ATTR = { "data-col-optional": "" };

export function GenericTable<R extends GenericListRow>({
  rows,
  type,
  columns,
  noun,
  filtered,
  open,
}: {
  rows: R[];
  type: BrowsableType;
  columns: GenericColumn<R>[];
  /** The plural, for the empty state. */
  noun: string;
  /** Whether a search is narrowing the list, which changes what empty means. */
  filtered?: boolean;
  /** Renders one entity for the aside. The route supplies its server function. */
  open: (source: string, slug: string) => Promise<ReactNode>;
}) {
  if (rows.length === 0) {
    return <EmptyState noun={noun} filtered={filtered ?? false} />;
  }

  return (
    <Box overflowX="auto">
      <Table.Root size="sm" interactive stickyHeader>
        <Table.Header>
          <Table.Row bg="bg.muted">
            <Header>Name</Header>
            {columns.map((column) => (
              <Header key={column.label} optional={column.optional}>
                {column.label}
              </Header>
            ))}
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {rows.map((row) => (
            <GenericRowView
              key={row.id}
              row={row}
              type={type}
              columns={columns}
              open={open}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}

function GenericRowView<R extends GenericListRow>({
  row,
  type,
  columns,
  open,
}: {
  row: R;
  type: BrowsableType;
  columns: GenericColumn<R>[];
  open: (source: string, slug: string) => Promise<ReactNode>;
}) {
  const href = hrefFor({
    entityType: type,
    sourceId: row.sourceId,
    slug: row.slug,
  });

  return (
    <Table.Row position="relative">
      <Cell fontWeight="medium" nowrap>
        {/*
          One anchor stretched over the whole row by a pseudo-element, rather
          than a link per cell — several identical links per row is noise with a
          keyboard or a screen reader.

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
            /*
             * The entity's canonical URL, which is what every inbound tag in
             * the books already points at — even though nothing serves it:
             * these types render in the aside and have no page of their own.
             * Kept because it is the entity's identity and what "copy link
             * address" should yield, not because it resolves.
             */
            href={href ?? "#"}
            // Built the same way the reader's links build theirs, so an entity
            // opened from a chapter and the same one opened from this table are
            // one entry in the cache and one selected row, not two.
            entityKey={asideKey(type, row.sourceId, row.slug)}
            label={row.name}
            load={open.bind(null, row.sourceId, row.slug)}
          >
            {row.name}
          </AsideLink>
        </Box>
      </Cell>

      {columns.map((column) => (
        <Cell
          key={column.label}
          optional={column.optional}
          nowrap={column.nowrap}
        >
          {column.cell(row)}
        </Cell>
      ))}
    </Table.Row>
  );
}

function Header({
  children,
  optional,
}: {
  children: ReactNode;
  optional?: boolean;
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
    >
      {children}
    </Table.ColumnHeader>
  );
}

function Cell({
  children,
  nowrap,
  optional,
  fontWeight,
}: {
  children: ReactNode;
  nowrap?: boolean;
  optional?: boolean;
  fontWeight?: string;
}) {
  return (
    <Table.Cell
      {...(optional ? OPTIONAL_ATTR : {})}
      fontFamily="ui"
      fontSize="xs"
      fontWeight={fontWeight}
      color="fg.muted"
      whiteSpace={nowrap ? "nowrap" : undefined}
    >
      {children}
    </Table.Cell>
  );
}

/**
 * Two different emptinesses. A list nothing narrowed is empty only with an
 * unseeded database, so it says that rather than offering to widen a search
 * that was never made; a search that matched nothing says so instead.
 */
function EmptyState({ noun, filtered }: { noun: string; filtered: boolean }) {
  return (
    <Box px="6" py="16" textAlign="center">
      <Text fontFamily="body" fontSize="md" color="fg.muted">
        {filtered ? `No ${noun} match that search.` : `No ${noun} to show.`}
      </Text>
    </Box>
  );
}
