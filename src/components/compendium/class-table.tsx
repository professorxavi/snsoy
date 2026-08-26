import { Box, Table, Text } from "@chakra-ui/react";
import { Inline } from "@/components/entry";
import { SIDEWAYS_SCROLLBAR } from "@/components/layout/constants";
import {
  CLASS_LEVELS,
  ordinal,
  proficiencyBonus,
  type ProgressionColumn,
} from "@/lib/content/classes";
import type { ReferenceIndex } from "@/lib/content/references";

/**
 * The class progression table: twenty levels down, everything the class gains
 * across.
 *
 * Three columns are the same for every class — level, proficiency bonus, and
 * the features gained — and the rest come from the class's own data. A Wizard
 * brings ten more (cantrips, then nine spell-slot columns), which is why this
 * table is allowed further into the margins than any other figure on the page:
 * thirteen columns inside a 68-character measure is 45px a column.
 *
 * Sticky first column, because the level is the row's identity and a table this
 * wide is read by scrolling sideways.
 */

export interface ClassTableRow {
  level: number;
  /** Names of the features gained at this level, in printed order. */
  features: string[];
}

export function ClassTable({
  columns,
  rows,
  className,
  heading,
  refs,
}: {
  columns: ProgressionColumn[];
  rows: ClassTableRow[];
  /** The class's name, for labelling unsupported tags in the coverage report. */
  className: string;
  /**
   * The section's heading, rendered inside the bleed so it sits on the table's
   * left edge rather than the prose column's.
   */
  heading?: React.ReactNode;
  refs?: ReferenceIndex;
}) {
  // Columns under one heading are printed as a spanned group above them; the
  // three standard columns and any ungrouped extras sit under a blank span.
  const groups = groupSpans(columns);
  const hasGroups = groups.some((group) => group.label);
  const byLevel = new Map(rows.map((row) => [row.level, row]));

  return (
    <Box>
      {heading}

      <Box
        overflowX="auto"
        css={SIDEWAYS_SCROLLBAR}
        borderWidth="1px"
        borderColor="border"
        rounded="l1"
      >
        <Table.Root size="sm" variant="line" width="100%">
          <Table.Header>
            {hasGroups ? (
              <Table.Row bg="bg.muted">
                {groups.map((group, index) => (
                  <Table.ColumnHeader
                    key={index}
                    colSpan={group.span}
                    textAlign="center"
                    fontFamily="ui"
                    fontSize="2xs"
                    fontWeight="semibold"
                    letterSpacing="wide"
                    textTransform="uppercase"
                    color="fg.subtle"
                    borderBottomWidth="0"
                  >
                    {group.label ?? ""}
                  </Table.ColumnHeader>
                ))}
              </Table.Row>
            ) : null}

            <Table.Row bg="bg.muted">
              <HeadCell sticky>Level</HeadCell>
              <HeadCell align="center">Bonus</HeadCell>
              <HeadCell>Features</HeadCell>
              {columns.map((column, index) => (
                <HeadCell key={index} align="center">
                  <Inline text={column.label} refs={refs} context={className} />
                </HeadCell>
              ))}
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {CLASS_LEVELS.map((level) => (
              <Table.Row key={level}>
                <BodyCell sticky nowrap>
                  <Text as="span" fontWeight="semibold">
                    {ordinal(level)}
                  </Text>
                </BodyCell>
                <BodyCell align="center" nowrap>
                  +{proficiencyBonus(level)}
                </BodyCell>
                <BodyCell>
                  {byLevel.get(level)?.features.join(", ") || "—"}
                </BodyCell>
                {columns.map((column, index) => (
                  <BodyCell key={index} align="center" nowrap>
                    {/*
                     * Rendered, not printed. A cell is usually a number, but
                     * the Warlock's Slot Level column is twenty spell-list
                     * links — the one column in the books whose values are
                     * tags rather than values.
                     */}
                    <Inline
                      text={column.values[level - 1] ?? "—"}
                      refs={refs}
                      context={className}
                    />
                  </BodyCell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}

/**
 * The spanned heading row: one entry per run of columns sharing a group name,
 * with the three standard columns folded into the leading blank span.
 */
function groupSpans(columns: ProgressionColumn[]) {
  const spans: { label?: string; span: number }[] = [{ span: STANDARD_COLUMNS }];

  for (const column of columns) {
    const last = spans[spans.length - 1]!;
    if (last.label === column.group) {
      last.span += 1;
      continue;
    }
    spans.push({ label: column.group, span: 1 });
  }

  return spans;
}

const STANDARD_COLUMNS = 3;

/**
 * The level column stays put while the rest scrolls. It carries its own
 * background: a sticky cell sits over the row it came from, and a transparent
 * one would let the scrolling cells show through it.
 */
const stickyCell = {
  position: "sticky" as const,
  left: "0",
  zIndex: 1,
};

function HeadCell({
  children,
  align,
  sticky,
}: {
  children: React.ReactNode;
  align?: "center";
  sticky?: boolean;
}) {
  return (
    <Table.ColumnHeader
      fontFamily="ui"
      /*
       * Not uppercased, unlike every other table head in the app. These are
       * `nowrap` and several are long — "Invocations Known" — so they set the
       * table's width outright, and uppercasing costs more width than the
       * smaller size saves.
       */
      fontSize="2xs"
      fontWeight="semibold"
      textAlign={align}
      whiteSpace="nowrap"
      px="2"
      {...(sticky ? { ...stickyCell, bg: "bg.muted" } : {})}
    >
      {children}
    </Table.ColumnHeader>
  );
}

function BodyCell({
  children,
  align,
  nowrap,
  sticky,
}: {
  children: React.ReactNode;
  align?: "center";
  nowrap?: boolean;
  sticky?: boolean;
}) {
  return (
    <Table.Cell
      fontFamily="body"
      /*
       * A step below the prose, and tighter than a default cell.
       *
       * This is the widest thing in the app — a Warlock's progression is eight
       * columns — and it now lives inside the reading measure rather than
       * reaching out past it. Set at the body size it overflowed by about a
       * column; at the size the browse table already uses for data it fits,
       * which is the difference between reading a level's row across and
       * scrolling to finish it.
       */
      fontSize="xs"
      lineHeight="1.45"
      px="2"
      verticalAlign="top"
      textAlign={align}
      whiteSpace={nowrap ? "nowrap" : undefined}
      fontVariantNumeric="tabular-nums"
      {...(sticky ? { ...stickyCell, bg: "bg.panel" } : {})}
    >
      {children}
    </Table.Cell>
  );
}
