import { Box, Table } from "@chakra-ui/react";
import type { ReactNode } from "react";

/**
 * The cells every browse list is built from.
 *
 * Five lists — spells, monsters, items, skills and the generic one behind the
 * rest — had grown their own copies of these two components. Three of the five
 * were byte-identical and the other two differed only in which props they
 * accepted, so the styling was the same decision written five times and able to
 * drift four ways.
 *
 * Only the frame and the cells are shared. A browse list carries sorting, row
 * links and filtering, none of which belongs to a book table and none of which
 * is touched here.
 */

/**
 * Marks a column a reader can lose when the aside takes the width.
 *
 * Never on the column that answers "which of these do I want", which is the
 * whole reason the list is still on screen.
 */
export const OPTIONAL_COLUMN = { "data-col-optional": "" };

/**
 * A browse list, in the box that owns its sideways scrolling.
 *
 * That box is why the headings do not hold as the page scrolls, and cannot: a
 * box with `overflow-x: auto` scrolls in both axes as far as CSS is concerned,
 * so it — not the page — is what a sticky heading inside it holds against, and
 * it never scrolls downwards. The book tables meet the same wall, and the
 * answer there was to let a table have the wrapper or a page-sticky heading and
 * never both.
 *
 * Here the wrapper wins, and it is not close: the spell list is 702px wider
 * than a 320px screen and 210px wider than a 1024px one. Columns a reader
 * cannot reach are worse than headings that scroll away.
 *
 * What the box does get is the marking every other scrolling table has, so the
 * shared enhancer gives it a tab stop and a name when it actually overflows.
 * Before this it was the one scroll region in the app reachable only by mouse.
 *
 * The bounded book-table viewport is deliberately not used. A browse list is
 * the page rather than a figure inside it, and the page owns its long scroll.
 */
export function BrowseTable({
  label,
  children,
}: {
  /** Names the region if it overflows. */
  label: string;
  children: ReactNode;
}) {
  return (
    <Box overflowX="auto" data-table-scroll="" data-table-label={label}>
      <Table.Root size="sm" interactive stickyHeader>
        {children}
      </Table.Root>
    </Box>
  );
}

export function BrowseHeader({
  children,
  optional,
  numeric,
  sorted,
}: {
  children: ReactNode;
  optional?: boolean;
  /** Right-aligned, for a column of values rather than names. */
  numeric?: boolean;
  /** Announced on the header cell itself, which is where `aria-sort` belongs. */
  sorted?: boolean;
}) {
  return (
    <Table.ColumnHeader
      {...(optional ? OPTIONAL_COLUMN : {})}
      aria-sort={sorted ? "ascending" : undefined}
      fontFamily="ui"
      /*
       * The shared header size, as the book tables and the class progression
       * use. These were a step smaller, which read as a label over the list
       * rather than as the heading of the column beneath it.
       */
      fontSize="xs"
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

export function BrowseCell({
  children,
  nowrap,
  optional,
  numeric,
  muted,
  fontWeight,
}: {
  children: ReactNode;
  nowrap?: boolean;
  optional?: boolean;
  numeric?: boolean;
  /** A value the row carries but does not lead with. */
  muted?: boolean;
  fontWeight?: string;
}) {
  return (
    <Table.Cell
      {...(optional ? OPTIONAL_COLUMN : {})}
      fontFamily="ui"
      fontSize="xs"
      fontWeight={fontWeight}
      color={muted ? "fg.subtle" : "fg.muted"}
      whiteSpace={nowrap ? "nowrap" : undefined}
      textAlign={numeric ? "end" : undefined}
      fontVariantNumeric={numeric ? "tabular-nums" : undefined}
    >
      {children}
    </Table.Cell>
  );
}
