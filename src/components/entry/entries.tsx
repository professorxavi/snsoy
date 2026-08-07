import { Box, Stack, Table, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { ReferenceIndex } from "@/lib/content/references";
import { reportGap } from "./coverage";
import { Inline } from "./inline";
import {
  isCell,
  isEntryObject,
  type CellEntry,
  type Entry,
  type EntriesEntry,
  type InsetEntry,
  type ItemEntry,
  type ListEntry,
  type QuoteEntry,
  type TableEntry,
} from "./types";

/**
 * Corpus prose, rendered as blocks.
 *
 * Entries nest arbitrarily — a spell's description holds sub-sections, which
 * hold lists, which hold items, which hold more entries — so this is one
 * mutually recursive family of components rather than a flat switch.
 *
 * Typography follows the reading case rather than the app case: Literata at a
 * generous line height, because the thing being rendered is prose someone reads
 * during a game, not UI copy they scan.
 */

interface RenderContext {
  refs?: ReferenceIndex;
  /** The entity being rendered, so it never links to itself. */
  selfKey?: string;
  /** Entity name, for the coverage report. */
  context?: string;
  /** Heading level for the outermost named sub-section. */
  headingLevel?: 3 | 4 | 5;
}

export interface EntriesProps extends RenderContext {
  entries?: Entry[];
}

/** A sequence of entries — the normal entry point. */
export function Entries({ entries, ...ctx }: EntriesProps) {
  if (!entries?.length) return null;

  return (
    <Stack gap="3">
      {entries.map((entry, index) => (
        <EntryNode key={index} entry={entry} {...ctx} />
      ))}
    </Stack>
  );
}

function EntryNode({ entry, ...ctx }: { entry: Entry } & RenderContext) {
  // Bare strings are the overwhelming majority of all corpus text.
  if (typeof entry === "string" || typeof entry === "number") {
    return <Paragraph>{inline(String(entry), ctx)}</Paragraph>;
  }

  if (!isEntryObject(entry)) return null;

  switch (entry.type) {
    case "entries":
      return <SubSection entry={entry as EntriesEntry} ctx={ctx} />;

    case "list":
      return <ListBlock entry={entry as ListEntry} ctx={ctx} />;

    case "item":
    case "itemSpell":
    case "itemSub":
      return <ItemBlock entry={entry as ItemEntry} ctx={ctx} />;

    case "table":
      return <TableBlock entry={entry as TableEntry} ctx={ctx} />;

    case "quote":
      return <QuoteBlock entry={entry as QuoteEntry} ctx={ctx} />;

    case "inset":
    case "insetReadaloud":
      return <InsetBlock entry={entry as InsetEntry} ctx={ctx} />;

    default:
      reportGap("entry", String(entry.type), ctx.context);
      return <UnsupportedBlock type={String(entry.type)} />;
  }
}

const inline = (text: string, ctx: RenderContext) => (
  <Inline
    text={text}
    refs={ctx.refs}
    selfKey={ctx.selfKey}
    context={ctx.context}
  />
);

function Paragraph({ children }: { children: ReactNode }) {
  return (
    <Text
      className="prose"
      fontFamily="body"
      fontSize="md"
      lineHeight="1.65"
      textWrap="pretty"
    >
      {children}
    </Text>
  );
}

/**
 * A named sub-section.
 *
 * The name is optional and frequently absent, in which case this is just a
 * grouping and must not introduce a heading — an empty `<h4>` would be a real
 * accessibility defect, not a cosmetic one.
 */
function SubSection({ entry, ctx }: { entry: EntriesEntry; ctx: RenderContext }) {
  const level = ctx.headingLevel ?? 3;
  const nested: RenderContext = {
    ...ctx,
    headingLevel: level < 5 ? ((level + 1) as 4 | 5) : 5,
  };

  return (
    <Box>
      {entry.name ? (
        <Text
          as={`h${level}`}
          fontFamily="body"
          fontWeight="semibold"
          fontSize="md"
          mb="1"
        >
          {inline(entry.name, ctx)}
        </Text>
      ) : null}
      <Entries entries={entry.entries} {...nested} />
    </Box>
  );
}

function ListBlock({ entry, ctx }: { entry: ListEntry; ctx: RenderContext }) {
  if (!entry.items?.length) return null;

  return (
    <Stack
      as="ul"
      gap="1.5"
      pl="5"
      css={{ listStyleType: "disc", "& > li": { display: "list-item" } }}
    >
      {entry.items.map((item, index) => (
        <Box as="li" key={index}>
          <EntryNode entry={item} {...ctx} />
        </Box>
      ))}
    </Stack>
  );
}

/**
 * A labelled item — "**Name.** description", the corpus's most common way of
 * writing a definition list, and the shape spell option lists take.
 */
function ItemBlock({ entry, ctx }: { entry: ItemEntry; ctx: RenderContext }) {
  const body = entry.entries ?? (entry.entry != null ? [entry.entry] : []);

  return (
    <Box>
      {entry.name ? (
        <Text as="span" fontFamily="body" fontWeight="semibold">
          {inline(entry.name, ctx)}{" "}
        </Text>
      ) : null}
      {body.map((child, index) =>
        typeof child === "string" || typeof child === "number" ? (
          // Inline with the label, so "Name. text" reads as one sentence.
          <Text
            as="span"
            key={index}
            className="prose"
            fontFamily="body"
            lineHeight="1.65"
          >
            {inline(String(child), ctx)}
          </Text>
        ) : (
          <EntryNode key={index} entry={child} {...ctx} />
        ),
      )}
    </Box>
  );
}

/**
 * A random table.
 *
 * The first column is nearly always a die roll, which is why `cell` exists as
 * an entry type at all — it carries a range (`min`/`max`) rather than text.
 * Tabular figures and right alignment keep those ranges scannable.
 *
 * Wrapped in its own scroll container: a wide table must never make the page
 * scroll sideways, and the aside it may be rendered into is only 400px.
 */
function TableBlock({ entry, ctx }: { entry: TableEntry; ctx: RenderContext }) {
  if (!entry.rows?.length) return null;

  return (
    <Box my="1">
      {entry.caption ? (
        <Text
          fontFamily="ui"
          fontSize="xs"
          fontWeight="medium"
          textTransform="uppercase"
          letterSpacing="wide"
          color="fg.subtle"
          mb="1.5"
        >
          {inline(entry.caption, ctx)}
        </Text>
      ) : null}

      <Box overflowX="auto" borderWidth="1px" borderColor="border" rounded="l1">
        <Table.Root size="sm" variant="line">
          {entry.colLabels?.length ? (
            <Table.Header>
              <Table.Row bg="bg.muted">
                {entry.colLabels.map((label, index) => (
                  <Table.ColumnHeader
                    key={index}
                    fontFamily="ui"
                    fontSize="xs"
                    fontWeight="semibold"
                    whiteSpace="nowrap"
                  >
                    {inline(label, ctx)}
                  </Table.ColumnHeader>
                ))}
              </Table.Row>
            </Table.Header>
          ) : null}

          <Table.Body>
            {entry.rows.map((row, rowIndex) => (
              <Table.Row key={rowIndex}>
                {(Array.isArray(row) ? row : [row]).map((cell, cellIndex) => (
                  <Table.Cell
                    key={cellIndex}
                    fontFamily="body"
                    fontSize="sm"
                    lineHeight="1.5"
                    verticalAlign="top"
                    whiteSpace={isCell(cell) ? "nowrap" : undefined}
                    fontVariantNumeric={isCell(cell) ? "tabular-nums" : undefined}
                  >
                    {isCell(cell) ? (
                      rollLabel(cell)
                    ) : (
                      <EntryNode entry={cell} {...ctx} />
                    )}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}

/** "01–05" or "17". Padding is the corpus's own flag, not a guess at width. */
function rollLabel(cell: CellEntry): string {
  const roll = cell.roll;
  if (!roll) return "";

  const pad = (value: number) =>
    roll.pad ? String(value).padStart(2, "0") : String(value);

  if (roll.exact != null) return pad(roll.exact);
  if (roll.min != null && roll.max != null) {
    return roll.min === roll.max
      ? pad(roll.min)
      : `${pad(roll.min)}–${pad(roll.max)}`;
  }
  return "";
}

/** Flavour text. Set in italic with an attribution rule, never in the slab. */
function QuoteBlock({ entry, ctx }: { entry: QuoteEntry; ctx: RenderContext }) {
  return (
    <Box
      as="blockquote"
      borderLeftWidth="2px"
      borderColor="border.emphasized"
      pl="4"
      py="0.5"
    >
      <Stack gap="2">
        {(entry.entries ?? []).map((child, index) => (
          <Text
            key={index}
            className="prose"
            fontFamily="body"
            fontStyle="italic"
            lineHeight="1.65"
            color="fg.muted"
          >
            {typeof child === "string" || typeof child === "number"
              ? inline(String(child), ctx)
              : null}
          </Text>
        ))}
      </Stack>

      {entry.by ? (
        <Text
          as="cite"
          display="block"
          mt="1.5"
          fontFamily="ui"
          fontSize="xs"
          fontStyle="normal"
          color="fg.subtle"
        >
          &mdash; {inline(entry.by, ctx)}
          {entry.from ? `, ${entry.from}` : null}
        </Text>
      ) : null}
    </Box>
  );
}

/** A sidebar. Reads as a boxed aside in print, so it gets a real box here. */
function InsetBlock({ entry, ctx }: { entry: InsetEntry; ctx: RenderContext }) {
  return (
    <Box
      bg="bg.muted"
      borderWidth="1px"
      borderColor="border"
      borderLeftWidth="3px"
      borderLeftColor="brand"
      rounded="l1"
      px="4"
      py="3"
    >
      {entry.name ? (
        <Text
          as="h4"
          fontFamily="display"
          fontSize="sm"
          lineHeight="1.2"
          mb="2"
        >
          {inline(entry.name, ctx)}
        </Text>
      ) : null}
      <Entries entries={entry.entries} {...ctx} />
    </Box>
  );
}

function UnsupportedBlock({ type }: { type: string }) {
  return (
    <Box
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="marque"
      bg="marque/10"
      rounded="l1"
      px="3"
      py="2"
    >
      <Text fontFamily="ui" fontSize="xs" color="marque">
        Unsupported content block: {type}
      </Text>
    </Box>
  );
}
