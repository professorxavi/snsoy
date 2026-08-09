import { Box, Table, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { AsideLink } from "@/components/compendium/aside-link";
import { asideKey } from "@/lib/aside";
import { conditionEffect } from "@/lib/content/conditions";
import { hrefFor } from "@/lib/routes";
import type { ConditionRow } from "@/server/db/queries/conditions";

/**
 * The condition list. A row click opens the condition beside the list rather
 * than navigating away from it, as everywhere else in the compendium.
 *
 * Simpler than the skill table by one column and one decision: fifteen rows
 * from one book, and nothing about a condition to sort on but its name, so
 * there are no sortable headers and no `sort` in the URL.
 *
 * The effect line stays when the aside opens, wrapping instead of dropping out.
 * It is the only thing on the row worth reading, and a reader working through
 * the conditions one at a time should be able to see what the next one does
 * while the last one is still open.
 *
 * Stays a server component. Only the name in each row is a client component,
 * and `open` arrives as a prop rather than an import — a shared component has
 * no business importing a route's action, and doing so would drag the database
 * client into every test that renders a table.
 */
export function ConditionTable({
  rows,
  open,
}: {
  rows: ConditionRow[];
  /** Renders one condition for the aside. The route supplies its function. */
  open: (source: string, slug: string) => Promise<ReactNode>;
}) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <Box overflowX="auto">
      <Table.Root size="sm" interactive stickyHeader>
        <Table.Header>
          <Table.Row bg="bg.muted">
            <Header>Name</Header>
            <Header>Effect</Header>
            <Header optional>Source</Header>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {rows.map((row) => (
            <ConditionRowView key={row.id} row={row} open={open} />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}

function ConditionRowView({
  row,
  open,
}: {
  row: ConditionRow;
  open: (source: string, slug: string) => Promise<ReactNode>;
}) {
  const href = hrefFor({
    entityType: "condition",
    sourceId: row.sourceId,
    slug: row.slug,
  });

  return (
    <Table.Row position="relative">
      <Cell fontWeight="medium" nowrap>
        {/*
          One anchor stretched over the whole row by a pseudo-element, rather
          than a link per cell. The row's tint follows the anchor's
          `aria-current` through a `:has()` rule in `BrowseFrame`, so the
          selection needs no prop and this stays a server component.
        */}
        <Box
          asChild
          color="fg"
          _after={{ content: '""', position: "absolute", inset: 0 }}
          _hover={{ color: "brand" }}
        >
          <AsideLink
            /*
             * The condition's canonical URL, which is what all 6,894 inbound
             * `{@condition}` tags already point at — even though nothing serves
             * it: a condition renders in the aside and has no page of its own.
             * Kept because it is the entity's identity and what "copy link
             * address" should yield, not because it resolves.
             */
            href={href ?? "#"}
            // Built the same way the reader's links build theirs, so a
            // condition opened from a stat block and the same one opened from
            // this table are one entry in the cache and one selected row.
            entityKey={asideKey("condition", row.sourceId, row.slug)}
            label={row.name}
            load={open.bind(null, row.sourceId, row.slug)}
          >
            {row.name}
          </AsideLink>
        </Box>
      </Cell>

      <Cell>{conditionEffect(row.slug)}</Cell>
      <Cell optional muted nowrap>
        {row.sourceId}
      </Cell>
    </Table.Row>
  );
}

/** Columns the browse frame's CSS hides while the aside is open. */
const OPTIONAL_ATTR = { "data-col-optional": "" };

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
  optional,
  muted,
  nowrap,
  fontWeight,
}: {
  children: ReactNode;
  optional?: boolean;
  muted?: boolean;
  /** Set on the columns that must not wrap. The effect line is free to. */
  nowrap?: boolean;
  fontWeight?: string;
}) {
  return (
    <Table.Cell
      {...(optional ? OPTIONAL_ATTR : {})}
      fontFamily="ui"
      fontSize="xs"
      fontWeight={fontWeight}
      color={muted ? "fg.subtle" : "fg.muted"}
      whiteSpace={nowrap ? "nowrap" : undefined}
    >
      {children}
    </Table.Cell>
  );
}

/**
 * Only reachable with an unseeded database — nothing here filters — so it says
 * that rather than offering to widen a search that was never narrowed.
 */
function EmptyState() {
  return (
    <Box px="6" py="16" textAlign="center">
      <Text fontFamily="body" fontSize="md" color="fg.muted">
        No conditions to show.
      </Text>
    </Box>
  );
}
