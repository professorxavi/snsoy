import { Box, Stack, Table, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { Fragment, type ReactNode } from "react";
import { Illustration, isLandscape } from "@/components/compendium/entity-image";
import { SIDEWAYS_SCROLLBAR } from "@/components/layout/constants";
import {
  featureReferenceKey,
  type FeatureIndex,
} from "@/lib/content/classes";
import { abilityPhrase } from "@/lib/content/dnd";
import type { ImageEntry } from "@/lib/content/media";
import { spellFrequencyLabel, spellLevelLabel } from "@/lib/content/monsters";
import {
  optionalFeatureKey,
  type OptionalFeatureBody,
  type OptionalFeatureIndex,
} from "@/lib/content/optional-features";
import {
  candidateKeysForStatblock,
  lookupReference,
  type ReferenceIndex,
} from "@/lib/content/references";
import { columnStyles } from "@/lib/content/tables";
import { reportGap } from "./coverage";
import { Inline } from "./inline";
import {
  cellsOf,
  isCell,
  isEntryObject,
  isRow,
  type AbilityFormulaEntry,
  type AttackEntry,
  type CellEntry,
  type Entry,
  type EntryObject,
  type EntriesEntry,
  type LinkEntry,
  type GalleryEntry,
  type InsetEntry,
  type ItemEntry,
  type ListEntry,
  type OptionsEntry,
  type QuoteEntry,
  type RefOptionalFeatureEntry,
  type RowEntry,
  type SectionEntry,
  type SpellcastingEntry,
  type StatblockEntry,
  type TableEntry,
  type TableGroupEntry,
} from "./types";

/**
 * Renders entry prose as blocks. Entries nest arbitrarily, so these components
 * are mutually recursive rather than a flat switch.
 */

interface RenderContext {
  refs?: ReferenceIndex;
  /**
   * Bodies for the optional features a feature offers as a choice. Only class
   * pages load these; nothing else in the corpus contains an option list.
   */
  options?: OptionalFeatureIndex;
  /** Bodies for the features one feature builds another out of. Class pages only. */
  features?: FeatureIndex;
  /** The entity being rendered, so it does not link to itself. */
  selfKey?: string;
  /** Entity name, for the coverage report. */
  context?: string;
  /**
   * Heading level for the outermost named sub-section. Chapter bodies start at
   * 2, since the chapter title is the page's `h1`; a spell or race detail passes
   * nothing and starts at 3, below its own section headings.
   */
  headingLevel?: 2 | 3 | 4 | 5;
}

export interface EntriesProps extends RenderContext {
  entries?: Entry[];
}

/** A sequence of entries. The usual entry point. */
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
  // Bare strings are the bulk of all entry text.
  if (typeof entry === "string" || typeof entry === "number") {
    return <Paragraph>{inline(String(entry), ctx)}</Paragraph>;
  }

  if (!isEntryObject(entry)) return null;

  switch (entry.type) {
    case "entries":
    case "section":
      return <SubSection entry={entry as EntriesEntry} ctx={ctx} />;

    case "list":
      return <ListBlock entry={entry as ListEntry} ctx={ctx} />;

    case "item":
    case "itemSpell":
    case "itemSub":
      return <ItemBlock entry={entry as ItemEntry} ctx={ctx} />;

    case "abilityDc":
    case "abilityAttackMod":
      return (
        <AbilityFormula
          entry={entry as AbilityFormulaEntry}
          kind={entry.type}
        />
      );

    case "refClassFeature":
    case "refSubclassFeature":
      return <FeatureReference entry={entry} ctx={ctx} />;

    case "options":
      return <OptionsBlock entry={entry as OptionsEntry} ctx={ctx} />;

    case "refOptionalfeature":
      return (
        <OptionBlock entry={entry as RefOptionalFeatureEntry} ctx={ctx} />
      );

    case "table":
      return <TableBlock entry={entry as TableEntry} ctx={ctx} />;

    case "tableGroup":
      return <TableGroupBlock entry={entry as TableGroupEntry} ctx={ctx} />;

    case "quote":
      return <QuoteBlock entry={entry as QuoteEntry} ctx={ctx} />;

    case "inset":
    case "insetReadaloud":
      return <InsetBlock entry={entry as InsetEntry} ctx={ctx} />;

    case "variant":
      return <InsetBlock entry={entry as InsetEntry} ctx={ctx} />;

    // Named subdivisions of a variant. Already inside its box, so they are
    // headings rather than boxes of their own.
    case "variantInner":
    case "variantSub":
      return <SubSection entry={entry as EntriesEntry} ctx={ctx} />;

    case "spellcasting":
      return <SpellcastingBlock entry={entry as SpellcastingEntry} ctx={ctx} />;

    case "image":
      return <ImageBlock entry={entry as ImageEntry} ctx={ctx} />;

    case "gallery":
      return <GalleryBlock entry={entry as GalleryEntry} ctx={ctx} />;

    case "statblock":
      return <StatblockLink entry={entry as StatblockEntry} ctx={ctx} />;

    case "attack":
      return <AttackLine entry={entry as AttackEntry} ctx={ctx} />;

    case "inline":
      return <InlineRun entry={entry as EntriesEntry} ctx={ctx} />;

    case "link":
      return <Paragraph>{linkText(entry as LinkEntry, ctx)}</Paragraph>;

    case "hr":
      return <Box as="hr" borderTopWidth="1px" borderColor="border" my="2" />;

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

/**
 * An attack written as structure rather than as prose.
 *
 * The bestiary writes its attacks inline — `{@atk rw} {@hit +6} to hit, range
 * 120/480 ft. {@h}16 ({@damage 3d10}) piercing damage.` — and 13 of the 20
 * objects carry the same sentence split into fields instead. Rather than a
 * second way of styling the same line, the fields are put back into the form
 * the tags already produce, so an object's Bolt reads exactly as a creature's
 * would: same cues, same rolls, same spacing rule for `{@h}`, which supplies
 * its own trailing space.
 *
 * `attackType` is the `{@atk}` code in upper case, and the tag lower-cases it.
 */
function AttackLine({ entry, ctx }: { entry: AttackEntry; ctx: RenderContext }) {
  const attack = (entry.attackEntries ?? []).join(" ");
  const hit = (entry.hitEntries ?? []).join(" ");

  const line = [
    entry.attackType ? `{@atk ${entry.attackType}}` : null,
    attack || null,
    hit ? `{@h}${hit}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return <Paragraph>{inline(line, ctx)}</Paragraph>;
}

/**
 * A run of entries that belong in one paragraph rather than one apiece.
 *
 * The books use this where a sentence is interrupted by something structured —
 * a link, a formula — and the pieces have to close back up. Rendering the
 * children normally would break the sentence across two paragraphs mid-clause.
 */
function InlineRun({ entry, ctx }: { entry: EntriesEntry; ctx: RenderContext }) {
  return (
    <Paragraph>
      {entry.entries?.map((child, index) =>
        typeof child === "string" || typeof child === "number" ? (
          <Fragment key={index}>{inline(String(child), ctx)}</Fragment>
        ) : isEntryObject(child) && child.type === "link" ? (
          <Fragment key={index}>{linkText(child as LinkEntry, ctx)}</Fragment>
        ) : isEntryObject(child) ? (
          reportUnsupportedInlineChild(child, ctx)
        ) : null,
      )}
    </Paragraph>
  );
}

function reportUnsupportedInlineChild(
  child: EntryObject,
  ctx: RenderContext,
) {
  reportGap("entry", String(child.type), ctx.context);
  return null;
}

/**
 * A `link` entry's text.
 *
 * Only an external address becomes an anchor. An `internal` href addresses a
 * page of the reference site these files were written for — `statgen.html`, a
 * point-buy calculator — and this app has no such page, so linking it would
 * send a reader nowhere. The sentence keeps its words and loses its link, which
 * is the same thing `hrefFor` returning null does everywhere else.
 */
function linkText(entry: LinkEntry, ctx: RenderContext): ReactNode {
  const text = inline(entry.text ?? "", ctx);
  const url = entry.href?.type === "external" ? entry.href.url : null;

  if (!url) return text;

  return (
    <Box asChild color="brand" _hover={{ textDecoration: "underline" }}>
      <a href={url} rel="noreferrer noopener" target="_blank">
        {text}
      </a>
    </Box>
  );
}

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
 * A named sub-section. The name is often absent, in which case this is only a
 * grouping and must not emit an empty heading.
 */
function SubSection({
  entry,
  ctx,
}: {
  entry: EntriesEntry | SectionEntry;
  ctx: RenderContext;
}) {
  const level = ctx.headingLevel ?? 3;
  const nested: RenderContext = {
    ...ctx,
    headingLevel: level < 5 ? ((level + 1) as 3 | 4 | 5) : 5,
  };

  return (
    <Box>
      {entry.name ? (
        <Text
          as={`h${level}`}
          fontFamily="body"
          fontWeight="semibold"
          // The top two levels carry a chapter's structure, so they are set
          // larger and ruled; deeper ones are run-in headings above a paragraph.
          fontSize={level <= 3 ? "lg" : "md"}
          lineHeight="1.25"
          mb={level <= 3 ? "2" : "1"}
          pb={level <= 3 ? "1" : "0"}
          borderBottomWidth={level === 2 ? "1px" : "0"}
          borderColor="border"
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
 * A feature printed inside the feature that introduces it.
 *
 * This is how the corpus composes features: an Alchemist's opening feature
 * references the three it grants, and Perfected Armor references the two armor
 * models it chooses between. The pieces are stored as siblings at the same
 * level, so a page that lists them flat prints "Guardian" and "Infiltrator" as
 * features of their own, with nothing to say what they are models of.
 *
 * The body comes from the render context: the page has already loaded every
 * feature of the class, and a reference never leaves it.
 */
function FeatureReference({
  entry,
  ctx,
}: {
  entry: EntryObject;
  ctx: RenderContext;
}) {
  const key = featureReferenceKey(entry);
  const feature = key ? ctx.features?.[key] : undefined;

  if (!feature) {
    reportGap("feature", String(key ?? entry.type), ctx.context);
    return null;
  }

  return (
    <Box>
      <Text as="span" fontFamily="body" fontWeight="semibold">
        {feature.name}
      </Text>
      <Entries entries={feature.entries as Entry[] | undefined} {...ctx} />
    </Box>
  );
}

/**
 * The two derived numbers a spellcasting feature ends on:
 *
 *   Spell save DC = 8 + your proficiency bonus + your Charisma modifier
 *   Spell attack modifier = your proficiency bonus + your Charisma modifier
 *
 * Stored as a type rather than as text because the ability differs by class,
 * and in two cases is not fixed at all — a Sidekick's is whatever its
 * spellcasting feature granted, which the corpus writes as `spellcasting`.
 *
 * Set apart from the prose above it: this is a formula to be read once and
 * copied onto a character sheet, not a sentence.
 */
function AbilityFormula({
  entry,
  kind,
}: {
  entry: AbilityFormulaEntry;
  kind: "abilityDc" | "abilityAttackMod";
}) {
  const ability = abilityPhrase(entry.attributes);
  if (!ability) return null;

  const dc = kind === "abilityDc";
  const label = `${entry.name ?? "Spell"} ${dc ? "save DC" : "attack modifier"}`;

  return (
    <Text
      fontFamily="body"
      fontSize="sm"
      lineHeight="1.6"
      px="3"
      py="2"
      bg="bg.muted"
      rounded="l1"
    >
      <Text as="span" fontWeight="semibold">
        {label}
      </Text>
      {" = "}
      {dc ? "8 + " : ""}your proficiency bonus + your {ability} modifier
    </Text>
  );
}

/**
 * A choice between optional features. Set in from the prose that introduces it,
 * so a page of features stays readable as a list of things you have and the
 * choices inside them stay visibly subordinate.
 *
 * No "choose one" line is synthesised. The feature above an `options` block
 * says so in its own words every time, and a second one underneath reads as a
 * mistake.
 */
function OptionsBlock({
  entry,
  ctx,
}: {
  entry: OptionsEntry;
  ctx: RenderContext;
}) {
  if (!entry.entries?.length) return null;

  return (
    <Stack
      gap="2.5"
      mt="2"
      pl="4"
      borderLeftWidth="1px"
      borderColor="border"
    >
      {entry.entries.map((child, index) => (
        <EntryNode key={index} entry={child} {...ctx} />
      ))}
    </Stack>
  );
}

/**
 * One optional feature, printed where it is offered rather than linked away to.
 *
 * The bodies arrive through the render context because a page loads all of them
 * in one query — a Warlock's page resolves 54 invocations. Without them the
 * option still prints its name, which is what the corpus itself gives: a page
 * that silently drops the name would leave a feature saying "choose one of the
 * following" above nothing at all.
 */
function OptionBlock({
  entry,
  ctx,
}: {
  entry: RefOptionalFeatureEntry;
  ctx: RenderContext;
}) {
  const key = optionalFeatureKey(entry.optionalfeature);
  const option = key ? ctx.options?.[key] : undefined;

  if (!option) {
    reportGap("option", entry.optionalfeature, ctx.context);
    return (
      <Text as="span" fontFamily="body" fontWeight="semibold">
        {entry.optionalfeature.split("|")[0]}
      </Text>
    );
  }

  return <OptionBody option={option} {...ctx} />;
}

/**
 * An option's name, what it requires, and what it does.
 *
 * Exported because a class page prints whole lists of these directly — the ones
 * no feature names — and they have to look the same as the ones a feature does.
 */
export function OptionBody({
  option,
  ...ctx
}: { option: OptionalFeatureBody } & RenderContext) {
  return (
    <Box>
      <Text as="span" fontFamily="body" fontWeight="semibold">
        {option.name}
      </Text>
      {option.prerequisite ? (
        <Text
          as="span"
          fontFamily="body"
          fontSize="sm"
          fontStyle="italic"
          color="fg.muted"
          ml="2"
        >
          Prerequisite: {option.prerequisite}
        </Text>
      ) : null}
      <Entries entries={option.entries as Entry[] | undefined} {...ctx} />
    </Box>
  );
}

/** A labelled item: "Name. description" — the data's definition-list shape. */
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
          // Inline with the label so it reads as one sentence.
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
 * A random table. The first column is usually a die roll, which is what the
 * `cell` entry type carries.
 *
 * A wide table stays inside the measure and scrolls in its own container, so
 * nothing is ever cut off and the column keeps one edge all the way down the
 * page. It used to reach out into the margins instead, which stopped the
 * cut-off but left a table half again the width of the prose around it —
 * conspicuous in a layout whose whole point is a single measured column.
 */
function TableBlock({ entry, ctx }: { entry: TableEntry; ctx: RenderContext }) {
  if (!entry.rows?.length) return null;

  const columns = Math.max(
    entry.colLabels?.length ?? 0,
    ...entry.rows.map((row) => cellsOf(row).length),
  );
  const styles = columnStyles(entry.colStyles, columns);
  const sized = styles.some((style) => style.width);

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

      <Box
        overflowX="auto"
        css={SIDEWAYS_SCROLLBAR}
        borderWidth="1px"
        borderColor="border"
        rounded="l1"
      >
        <Table.Root
          size="sm"
          variant="line"
          width="100%"
          /*
           * A floor, so the printed shares mean something.
           *
           * The shares are percentages under `table-layout: auto`, which means
           * a column whose content cannot shrink further takes its room first
           * and the flexible ones divide what is left. Squeezed into the
           * reading measure that turns a four-twelfths column of sentences into
           * 129px beside a one-word column of 83 — the collapse the shares
           * exist to prevent. Given a floor the proportions come back, and what
           * does not fit is reached by scrolling the table rather than by
           * pushing it out past the column.
           *
           * Only where widths are declared: a table without them is sized by
           * its content and has nothing to be squeezed out of.
           */
          minW={sized ? `min(${(columns * 7.5).toFixed(1)}rem, 60rem)` : undefined}
        >
          {/*
           * Declared widths, not `table-layout: fixed`. The layout stays auto so
           * a column whose content cannot fit its printed share still takes the
           * room it needs, and the shares apply to everything that is left.
           */}
          {/*
           * Plain elements with an inline width, not `Table.Column` with a
           * style prop. A styled component emits its rule as a `<style>` tag
           * beside itself, and the HTML parser throws out anything inside a
           * `<colgroup>` that is not a `<col>` — so the parsed DOM loses them,
           * and every table on the page fails to hydrate.
           */}
          {sized ? (
            <colgroup>
              {styles.map((style, index) => (
                <col key={index} style={{ width: style.width }} />
              ))}
            </colgroup>
          ) : null}

          {entry.colLabels?.length ? (
            <Table.Header>
              <Table.Row bg="bg.muted">
                {entry.colLabels.map((label, index) => (
                  <Table.ColumnHeader
                    key={index}
                    fontFamily="ui"
                    fontSize="xs"
                    fontWeight="semibold"
                    // A long heading wraps. Holding it on one line makes it the
                    // column's minimum width, which is how "Saving Throw
                    // Proficiencies" came to be wider than the sentence beside it.
                    whiteSpace={styles[index]?.noWrap ? "nowrap" : undefined}
                    textAlign={styles[index]?.align}
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
                {cellsOf(row).map((cell, cellIndex) => (
                  <Table.Cell
                    key={cellIndex}
                    fontFamily="body"
                    fontSize="sm"
                    lineHeight="1.5"
                    verticalAlign="top"
                    whiteSpace={
                      isCell(cell) || styles[cellIndex]?.noWrap
                        ? "nowrap"
                        : undefined
                    }
                    fontVariantNumeric={isCell(cell) ? "tabular-nums" : undefined}
                    textAlign={styles[cellIndex]?.align}
                    // The equipment tables group their rows under a plain row of
                    // headings — "Light Armor" — and indent what belongs to it.
                    ps={indentsFirstCell(row) && cellIndex === 0 ? "6" : undefined}
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

/** Whether a row hangs under the grouping row above it. */
function indentsFirstCell(row: (Entry | CellEntry)[] | RowEntry): boolean {
  return isRow(row) && row.style === "row-indent-first";
}

/** "01-05" or "17". Padding comes from the cell's `pad` flag, not the width. */
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

/** Several tables under one heading, printed as a single figure. */
function TableGroupBlock({
  entry,
  ctx,
}: {
  entry: TableGroupEntry;
  ctx: RenderContext;
}) {
  if (!entry.tables?.length) return null;

  return (
    <Box>
      {entry.name ? (
        <Text
          as="h4"
          fontFamily="body"
          fontWeight="semibold"
          fontSize="md"
          mb="2"
        >
          {inline(entry.name, ctx)}
        </Text>
      ) : null}
      <Stack gap="3">
        {entry.tables.map((table, index) => (
          <TableBlock key={index} entry={table} ctx={ctx} />
        ))}
      </Stack>
    </Box>
  );
}

/**
 * Art printed inside body text. Wide images run the full column; taller ones are
 * height-capped and centred, so a portrait plate cannot push a page of prose
 * off the screen.
 */
function ImageBlock({ entry, ctx }: { entry: ImageEntry; ctx: RenderContext }) {
  const wide = isLandscape(entry);

  return (
    <Box
      as="figure"
      display="flex"
      flexDirection="column"
      alignItems="center"
      my="2"
    >
      <Box w={wide ? "100%" : "auto"} maxW="100%">
        <Illustration
          image={entry}
          entityName={ctx.context ?? ""}
          maxHeight={wide ? 420 : 520}
          sizes="(max-width: 48em) 100vw, 36rem"
        />
      </Box>
      {entry.title ? (
        <Text
          as="figcaption"
          mt="1.5"
          fontFamily="ui"
          fontSize="xs"
          color="fg.subtle"
          textAlign="center"
        >
          {inline(entry.title, ctx)}
        </Text>
      ) : null}
    </Box>
  );
}

/** Images printed together. Two up on anything wider than a phone. */
function GalleryBlock({
  entry,
  ctx,
}: {
  entry: GalleryEntry;
  ctx: RenderContext;
}) {
  if (!entry.images?.length) return null;

  return (
    <Box
      display="grid"
      gridTemplateColumns={{
        base: "1fr",
        sm: `repeat(${Math.min(entry.images.length, 2)}, minmax(0, 1fr))`,
      }}
      gap="3"
      alignItems="center"
      my="2"
    >
      {entry.images.map((image, index) => (
        <Illustration
          key={image.href?.path ?? index}
          image={image}
          entityName={ctx.context ?? ""}
          maxHeight={320}
          sizes="(max-width: 48em) 100vw, 18rem"
        />
      ))}
    </Box>
  );
}

/**
 * Where the printed book reproduces another entity in full. That entity has its
 * own page, so this links to it rather than duplicating a statblock the reader
 * would have to keep in sync.
 */
function StatblockLink({
  entry,
  ctx,
}: {
  entry: StatblockEntry;
  ctx: RenderContext;
}) {
  const label = entry.displayName ?? entry.name;
  const hit = ctx.refs
    ? lookupReference(candidateKeysForStatblock(entry), ctx.refs)
    : null;

  if (!label) return null;

  const body = (
    <>
      <Text
        as="span"
        fontFamily="ui"
        fontSize="2xs"
        fontWeight="semibold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="fg.subtle"
        display="block"
        mb="0.5"
      >
        {entry.tag ?? entry.prop?.replace(/Fluff$/, "") ?? "Entry"}
      </Text>
      <Text as="span" fontFamily="body" fontWeight="medium">
        {label}
      </Text>
    </>
  );

  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      borderLeftWidth="3px"
      borderLeftColor={hit?.target.href ? "reference" : "border.emphasized"}
      rounded="l1"
      px="4"
      py="2.5"
    >
      {hit?.target.href ? (
        <Box asChild _hover={{ color: "reference" }}>
          <NextLink href={hit.target.href}>{body}</NextLink>
        </Box>
      ) : (
        body
      )}
    </Box>
  );
}

/** Flavour text, set in italic with its attribution below. */
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

/**
 * A creature's spellcasting, which the corpus stores as structure rather than
 * as the sentence the book prints.
 *
 * Rendered as the trait it is: the name run in bold, the header sentence that
 * states the ability and save DC, then a line per group of spells. The groups
 * are not free text — "1/day each" is the key `"1e"` — so they are built here
 * rather than being read out of the data.
 *
 * `hidden` is honoured. Fifty-seven blocks list a group there because something
 * else already prints it, usually an action that spells out the same casting,
 * and printing it in both places is how a creature ends up appearing to cast
 * the spell twice.
 */
function SpellcastingBlock({
  entry,
  ctx,
}: {
  entry: SpellcastingEntry;
  ctx: RenderContext;
}) {
  const hidden = new Set(entry.hidden ?? []);

  /** The recovery each keyed group counts against, in printed order. */
  const KEYED_GROUPS = [
    ["rest", "rest"],
    ["daily", "day"],
    ["weekly", "week"],
    ["yearly", "year"],
    ["charges", "charges"],
    ["recharge", "recharge"],
  ] as const;

  const lines: { label: string; spells: Entry[] }[] = [];

  if (entry.will?.length && !hidden.has("will")) {
    lines.push({ label: "At will", spells: entry.will });
  }

  for (const [group, period] of KEYED_GROUPS) {
    const values = entry[group];
    if (!values || hidden.has(group)) continue;

    // Descending, so the rarest castings are read first, as in print.
    for (const key of Object.keys(values).sort().reverse()) {
      const spells = values[key];
      if (spells?.length) {
        lines.push({ label: spellFrequencyLabel(key, period), spells });
      }
    }
  }

  if (entry.ritual?.length && !hidden.has("ritual")) {
    lines.push({ label: "Rituals", spells: entry.ritual });
  }

  if (entry.spells && !hidden.has("spells")) {
    for (const level of Object.keys(entry.spells).sort()) {
      const slot = entry.spells[level];
      if (slot?.spells?.length) {
        lines.push({
          label: spellLevelLabel(level, slot.slots),
          spells: slot.spells,
        });
      }
    }
  }

  return (
    <Box>
      {entry.name ? (
        <Text as="span" fontFamily="body" fontWeight="semibold">
          {inline(entry.name, ctx)}{" "}
        </Text>
      ) : null}

      {/* Inline with the name, so the trait opens as one sentence. */}
      {entry.headerEntries?.length ? (
        <Text
          as="span"
          className="prose"
          fontFamily="body"
          lineHeight="1.65"
        >
          {entry.headerEntries.map((child, index) =>
            typeof child === "string" || typeof child === "number" ? (
              <Box as="span" key={index}>
                {inline(String(child), ctx)}
              </Box>
            ) : (
              <EntryNode key={index} entry={child} {...ctx} />
            ),
          )}
        </Text>
      ) : null}

      {lines.length ? (
        <Stack gap="0.5" mt="1.5" pl="4">
          {lines.map((line, index) => (
            <Text
              key={index}
              className="prose"
              fontFamily="body"
              fontSize="sm"
              lineHeight="1.6"
              textIndent="-1rem"
              pl="4"
            >
              <Text as="span" fontWeight="semibold">
                {line.label}:
              </Text>{" "}
              {line.spells.map((spell, spellIndex) => (
                <Box as="span" key={spellIndex}>
                  {spellIndex > 0 ? ", " : null}
                  {typeof spell === "string" || typeof spell === "number" ? (
                    inline(String(spell), ctx)
                  ) : (
                    <EntryNode entry={spell} {...ctx} />
                  )}
                </Box>
              ))}
            </Text>
          ))}
        </Stack>
      ) : null}

      {entry.footerEntries?.length ? (
        <Box mt="1.5">
          <Entries entries={entry.footerEntries} {...ctx} />
        </Box>
      ) : null}
    </Box>
  );
}

/** A sidebar. Boxed, as it is in print. */
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
