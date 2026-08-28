import { Box, Table, Text } from "@chakra-ui/react";
import { Inline } from "@/components/entry";
import { TableFrame } from "@/components/entry/table-frame";
import {
  CLASS_LEVELS,
  ordinal,
  proficiencyBonus,
  type ProgressionColumn,
} from "@/lib/content/classes";
import type { ReferenceIndex } from "@/lib/content/references";
import {
  columnMinWidth,
  tableLabel,
  tablePresentation,
} from "@/lib/content/tables";

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

      <TableFrame
        /*
         * A progression is read as a grid whatever its shape, and `Level` is
         * its row identity whatever the headings above happen to say — so both
         * are stated here rather than inferred from the cells.
         */
        presentation={tablePresentation({
          columns: columns.length + 3,
          rows: rows.length,
          header: true,
          intent: "progression",
        })}
        label={tableLabel({ explicit: `${className} progression` })}
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
                    /*
                     * The shared header size, as every other heading in every
                     * other table. It was a step smaller, which was the last
                     * piece of typography a single renderer decided for itself:
                     * the group reads as a heading through its uppercase, its
                     * colour and the rule beneath it, not by being quieter.
                     */
                    fontSize="xs"
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
              <HeadCell prose>Features</HeadCell>
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
                <BodyCell prose>
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
      </TableFrame>
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
 * The level column stays put while the rest scrolls — the level is the row's
 * identity, and a Wizard's thirteen columns are read by panning across them.
 *
 * Marked here, styled by `TableFrame`: pinning needs an opaque surface and a
 * stacking order that lets the head cross the column at the corner, and those
 * are the frame's to know so that every matrix pins its column the same way.
 */
const rowHeader = { "data-row-header": "" };

function HeadCell({
  children,
  align,
  sticky,
  prose,
}: {
  children: React.ReactNode;
  align?: "center";
  sticky?: boolean;
  /** The features column, which carries the same floor as its cells. */
  prose?: boolean;
}) {
  return (
    <Table.ColumnHeader
      fontFamily="ui"
      /*
       * Not uppercased, unlike every other table head in the app. These are
       * `nowrap` and several are long — "Invocations Known" — so they set the
       * table's width outright, and uppercasing costs more width than the size
       * saves.
       *
       * At the shared header size since the table stopped being held inside the
       * reading measure. It was a step smaller to buy width it no longer has to
       * find, and a heading two sizes under its own body text read as a label
       * for something else.
       */
      fontSize="xs"
      fontWeight="semibold"
      textAlign={align}
      whiteSpace="nowrap"
      px="2"
      minW={prose ? columnMinWidth("prose") : undefined}
      {...(sticky ? rowHeader : {})}
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
  prose,
}: {
  children: React.ReactNode;
  align?: "center";
  nowrap?: boolean;
  sticky?: boolean;
  /** The features column: a sentence, and read at the size sentences are read. */
  prose?: boolean;
}) {
  return (
    <Table.Cell
      fontFamily="body"
      /*
       * Data at the compact size, prose at the size prose is read.
       *
       * The whole table used to be a step below the body text. That bought
       * width while it was held inside the reading measure — set larger it
       * overflowed by about a column — but it also set feature names, which are
       * the only sentences here, two sizes under the paragraphs above them. The
       * table now takes the width of the column it sits in, so the room does
       * not have to come out of the words.
       */
      fontSize={prose ? "sm" : "xs"}
      lineHeight="1.45"
      px="2"
      verticalAlign="top"
      textAlign={align}
      whiteSpace={nowrap ? "nowrap" : undefined}
      /*
       * The same floor every other prose column in a table that reaches past
       * the measure is given. Without it the column claimed whatever the
       * compact columns left over — about 113px on a phone — and a feature
       * called "Font of Magic" came out three lines tall, which made the
       * twenty-level progression far longer than it needs to be.
       *
       * It buys that back with sideways travel, which the table already has and
       * which keeps Level in view. Width is never taken out of the words.
       */
      minW={prose ? columnMinWidth("prose") : undefined}
      fontVariantNumeric="tabular-nums"
      {...(sticky ? { as: "th" as const, scope: "row", ...rowHeader } : {})}
    >
      {children}
    </Table.Cell>
  );
}
