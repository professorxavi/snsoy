import { Box, Stack, Table, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  Illustration,
  isLandscape,
} from "@/components/compendium/entity-image";
import { featureReferenceKey, type FeatureIndex } from "@/lib/content/classes";
import { abilityPhrase } from "@/lib/content/dnd";
import type { ImageEntry } from "@/lib/content/media";
import { spellFrequencyLabel, spellLevelLabel } from "@/lib/content/monsters";
import { objectSummary } from "@/lib/content/objects";
import {
  optionalFeatureKey,
  type OptionalFeatureBody,
  type OptionalFeatureIndex,
} from "@/lib/content/optional-features";
import {
  candidateKeysForStatblock,
  lookupReference,
  plainText,
  type AnchoredIds,
  type AreaIndex,
  type ReferenceIndex,
} from "@/lib/content/references";
import {
  columnMinWidths,
  columnRole,
  columnStyles,
  tableAnchorId,
  tableLabel,
  tablePresentation,
} from "@/lib/content/tables";
import { reportGap } from "./coverage";
import { zoomAttrs } from "./zoom";
import { TableFrame } from "./table-frame";
import { Inline } from "./inline";
import {
  cellsOf,
  isCell,
  isCellHeader,
  isEntryObject,
  isRow,
  type AbilityFormulaEntry,
  type AbilityGenericEntry,
  type AttackEntry,
  type CellEntry,
  type CellHeaderEntry,
  type Entry,
  type EntryObject,
  type EntriesEntry,
  type FlowBlockEntry,
  type FlowchartEntry,
  type LinkEntry,
  type GalleryEntry,
  type InlineBlockEntry,
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
   * pages load these; nothing else in the books contains an option list.
   */
  options?: OptionalFeatureIndex;
  /** Bodies for the features one feature builds another out of. Class pages only. */
  features?: FeatureIndex;
  /** The entity being rendered, so it does not link to itself. */
  selfKey?: string;
  /** Entity name, for the coverage report. */
  context?: string;
  /**
   * The nearest named section a block sits in, which is what an uncaptioned
   * table is named after when it turns out to scroll. Every uncaptioned table
   * in the books has one.
   */
  sectionName?: string;
  /** Where this book's `{@area}` tags point. Chapter pages only. */
  areas?: AreaIndex;
  /** Which entry ids this page has to mark, so a link elsewhere can reach them. */
  anchored?: AnchoredIds;
  /**
   * The anchor each entry the chapter outline lists was given, keyed by the
   * entry itself. Chapter pages only.
   *
   * Keyed by identity rather than by id because the entries that need this most
   * are the ones the source data left without an id — nothing else addresses
   * them. Built by `chapterOutline` in `lib/content/outline`.
   */
  outlineAnchors?: WeakMap<object, string>;
  /**
   * Heading level for the outermost named sub-section. Chapter bodies start at
   * 2, since the chapter title is the page's `h1`; a spell or race detail passes
   * nothing and starts at 3, below its own section headings.
   */
  headingLevel?: HeadingLevel;
  /**
   * Which of the three visual steps a heading takes, which is not always its
   * element level. The books nest deeper than the scale has steps, and a page
   * may open a list of options under its own `h2` — semantically an `h3`, but it
   * reads as a side-head. Defaults to the level.
   */
  headingTier?: HeadingTier;
}

type HeadingLevel = 2 | 3 | 4 | 5;

/** 2 is a ruled section head, 3 a plain one, 4 the side-head. */
type HeadingTier = 2 | 3 | 4;

/**
 * The context inside a block that shows a name.
 *
 * Anything nested needs to know the nearest name a reader can actually see, and
 * the only place that is known is the block that drew it. Every renderer that
 * puts a heading on the page passes its name through here, so the rule is one
 * rule rather than a habit each of them has to remember.
 *
 * Nearest wins, and nearest is by nesting rather than by heading level: the
 * books nest deeper than the type scale has steps, so a side-head inside a
 * section is nearer than the section, whatever size it is set at.
 */
function under(ctx: RenderContext, name: string | undefined): RenderContext {
  return name?.trim() ? { ...ctx, sectionName: name } : ctx;
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
        <EntryNode key={index} entry={entry} first={index === 0} {...ctx} />
      ))}
    </Stack>
  );
}

/**
 * One entry, marked as an anchor when something can reach it.
 *
 * The mark goes here rather than on each block type so that every shape a link
 * or an outline row can address gets it in one place — a named `entries`, a
 * `section`, an `inset`, and the handful that are bare images with no name at
 * all. Which id it takes, if any, is `anchorFor`'s decision.
 */
function EntryNode({
  entry,
  first = true,
  ...ctx
}: { entry: Entry; first?: boolean } & RenderContext) {
  return (
    <Anchored id={anchorFor(entry, ctx)}>
      <EntryBody entry={entry} first={first} {...ctx} />
    </Anchored>
  );
}

/**
 * The id this entry's element carries, if any.
 *
 * Two things want an anchor here and they agree far more often than not: the
 * chapter outline needs every heading it lists to be reachable, and `{@area}`
 * needs the ids the books point at. An entry wanted by both gets one element,
 * since the outline uses the entry's own id wherever it has one.
 *
 * Nothing else is marked. The books hang 55,969 ids on entries and one page
 * carries 1,014 of them, so wrapping every one would be a great deal of markup
 * for anchors nothing can reach.
 */
function anchorFor(entry: Entry, ctx: RenderContext): string | undefined {
  if (!isEntryObject(entry)) return undefined;

  return (
    ctx.outlineAnchors?.get(entry) ??
    areaAnchor((entry as { id?: unknown }).id, ctx)
  );
}

/** The anchor for an id read off a node, where the book points at it. */
function areaAnchor(id: unknown, ctx: RenderContext): string | undefined {
  return typeof id === "string" && ctx.anchored?.[id] ? id : undefined;
}

/** The element a link or an outline row lands on. */
function Anchored({ id, children }: { id?: string; children: ReactNode }) {
  if (!id) return <>{children}</>;

  return (
    <Box id={id} scrollMarginTop="4rem">
      {children}
    </Box>
  );
}

function EntryBody({
  entry,
  first = true,
  ...ctx
}: { entry: Entry; first?: boolean } & RenderContext) {
  // Bare strings are the bulk of all entry text.
  if (typeof entry === "string" || typeof entry === "number") {
    return <Paragraph>{inline(String(entry), ctx)}</Paragraph>;
  }

  if (!isEntryObject(entry)) return null;

  switch (entry.type) {
    case "entries":
    case "section":
      return (
        <SubSection entry={entry as EntriesEntry} ctx={ctx} first={first} />
      );

    case "list":
      return <ListBlock entry={entry as ListEntry} ctx={ctx} />;

    case "item":
    case "itemSpell":
    case "itemSub":
      return <ItemBlock entry={entry as ItemEntry} ctx={ctx} first={first} />;

    case "abilityDc":
    case "abilityAttackMod":
      return (
        <AbilityFormula
          entry={entry as AbilityFormulaEntry}
          kind={entry.type}
        />
      );

    case "abilityGeneric":
      return <AbilityGeneric entry={entry as AbilityGenericEntry} ctx={ctx} />;

    case "refClassFeature":
    case "refSubclassFeature":
      return <FeatureReference entry={entry} ctx={ctx} first={first} />;

    case "options":
      return <OptionsBlock entry={entry as OptionsEntry} ctx={ctx} />;

    case "refOptionalfeature":
      return (
        <OptionBlock
          entry={entry as RefOptionalFeatureEntry}
          ctx={ctx}
          first={first}
        />
      );

    case "table":
      return <TableBlock entry={entry as TableEntry} ctx={ctx} />;

    case "tableGroup":
      return (
        <TableGroupBlock
          entry={entry as TableGroupEntry}
          ctx={ctx}
          first={first}
        />
      );

    case "quote":
      return <QuoteBlock entry={entry as QuoteEntry} ctx={ctx} />;

    case "inset":
    case "insetReadaloud":
      return <InsetBlock entry={entry as InsetEntry} ctx={ctx} />;

    case "flowchart":
      return <Flowchart entry={entry as FlowchartEntry} ctx={ctx} />;

    // Every one of the 115 is inside a flowchart, but `Flowchart` hands its
    // blocks to `Entries` rather than rendering them itself, so they arrive
    // back here and need a case of their own.
    case "flowBlock":
      return <FlowBlock entry={entry as FlowBlockEntry} ctx={ctx} />;

    case "variant":
      return <InsetBlock entry={entry as InsetEntry} ctx={ctx} />;

    // Named subdivisions of a variant. Already inside its box, so they are
    // headings rather than boxes of their own.
    case "variantInner":
    case "variantSub":
      return (
        <SubSection entry={entry as EntriesEntry} ctx={ctx} first={first} />
      );

    case "spellcasting":
      return <SpellcastingBlock entry={entry as SpellcastingEntry} ctx={ctx} />;

    case "image":
      return <ImageBlock entry={entry as ImageEntry} ctx={ctx} />;

    case "gallery":
      return <GalleryBlock entry={entry as GalleryEntry} ctx={ctx} />;

    case "statblock":
      return <StatblockLink entry={entry as StatblockEntry} ctx={ctx} />;

    case "statblockInline":
      return <InlineStatblock entry={entry} />;

    case "attack":
      return <AttackLine entry={entry as AttackEntry} ctx={ctx} />;

    case "inline":
      return <InlineRun entry={entry as EntriesEntry} ctx={ctx} />;

    /*
     * Not `InlineRun`, despite the name. Both occurrences are the PHB's list of
     * conditions — a sentence, then the fifteen names — and closing a list back
     * up into a sentence would drop it: `InlineRun` renders only strings and
     * links, and reports anything else as a gap. Rendered as the blocks they
     * are, which is how the page prints them.
     */
    case "inlineBlock":
      return <Entries entries={(entry as InlineBlockEntry).entries} {...ctx} />;

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
    areas={ctx.areas}
  />
);

/**
 * A stat block written into the text rather than pointed at.
 *
 * `statblock` addresses an entity that exists elsewhere and renders as a link
 * to it; this one carries the block itself, for something too small to be worth
 * its own entry in the books — all three occurrences are Clay No-Face, a Tiny
 * construct that exists only inside the charm that animates it.
 *
 * Printed as a name and the one line that matters, rather than as a full panel.
 * There is nothing to open and nothing more the data holds: no actions, no
 * abilities, just a size and a hit point total.
 */
function InlineStatblock({ entry }: { entry: EntryObject }) {
  const data = (entry as { data?: Record<string, unknown> }).data;
  if (!data || typeof data["name"] !== "string") return null;

  const name = data["name"];

  return (
    <Text fontFamily="body" fontSize="sm" lineHeight="1.55">
      <Text as="span" fontWeight="semibold">
        {name}
      </Text>{" "}
      <Text as="span" color="fg.muted">
        {objectSummary(data)}
      </Text>
    </Text>
  );
}

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
function AttackLine({
  entry,
  ctx,
}: {
  entry: AttackEntry;
  ctx: RenderContext;
}) {
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
function InlineRun({
  entry,
  ctx,
}: {
  entry: EntriesEntry;
  ctx: RenderContext;
}) {
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

function reportUnsupportedInlineChild(child: EntryObject, ctx: RenderContext) {
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
 * The heading over a named sub-section, and over everything else that names
 * itself and then takes a line of its own.
 *
 * Three visual steps, not five. The top two carry a chapter's structure and are
 * set large in the body face, the deeper one is a side-head: the ui face, small,
 * set against the serif it introduces. The break of face is what does the work,
 * because a name here runs from one word ("Archery") to a whole sentence — the
 * Sage Advice questions are names at this depth — and every treatment that
 * depends on brevity, small caps or letterspacing or the display face, falls
 * apart on the long ones.
 *
 * `first` is whether this opens its stack. Anything below the first gets a full
 * line above it and stays tight to what it introduces, so proximity says which
 * paragraph belongs to which name; the one that opens a stack is already under
 * the heading it belongs to and stays where it is.
 */
function SubHeading({
  level,
  tier,
  first,
  children,
}: {
  level: HeadingLevel;
  tier: HeadingTier;
  first?: boolean;
  children: ReactNode;
}) {
  const side = tier === 4;

  return (
    <Text
      as={`h${level}`}
      fontFamily={side ? "ui" : "body"}
      fontWeight="semibold"
      fontSize={side ? "sm" : "lg"}
      lineHeight={side ? "1.35" : "1.25"}
      letterSpacing={side ? "0.005em" : undefined}
      mt={first ? undefined : "3.5"}
      mb={side ? "1" : "2"}
      pb={side ? "0" : "1"}
      borderBottomWidth={tier === 2 ? "1px" : "0"}
      borderColor="border"
      textWrap="pretty"
    >
      {children}
    </Text>
  );
}

/**
 * A label that runs into the sentence it introduces — "Amphibious. The dragon
 * can breathe air and water." Deliberately not a heading: it names a thing
 * inside a paragraph rather than opening one, and giving it the side-head
 * treatment would put a heading in the middle of a sentence.
 */
function RunInLabel({ children }: { children: ReactNode }) {
  return (
    <Text as="span" fontFamily="body" fontWeight="semibold">
      {children}
    </Text>
  );
}

/** The visual step a level takes when nothing overrides it. */
function tierFor(level: HeadingLevel): HeadingTier {
  return level >= 4 ? 4 : (level as 2 | 3);
}

/**
 * A named sub-section. The name is often absent, in which case this is only a
 * grouping and must not emit an empty heading.
 */
function SubSection({
  entry,
  ctx,
  first,
}: {
  entry: EntriesEntry | SectionEntry;
  ctx: RenderContext;
  first?: boolean;
}) {
  const level = ctx.headingLevel ?? 3;
  const tier = ctx.headingTier ?? tierFor(level);
  const nested: RenderContext = {
    ...under(ctx, entry.name),
    headingLevel: level < 5 ? ((level + 1) as HeadingLevel) : 5,
    headingTier: tier < 4 ? ((tier + 1) as HeadingTier) : 4,
  };

  return (
    <Box>
      {entry.name ? (
        <SubHeading level={level} tier={tier} first={first}>
          {inline(entry.name, ctx)}
        </SubHeading>
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
 * This is how the books compose features: an Alchemist's opening feature
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
  first,
}: {
  entry: EntryObject;
  ctx: RenderContext;
  first?: boolean;
}) {
  const key = featureReferenceKey(entry);
  const feature = key ? ctx.features?.[key] : undefined;

  if (!feature) {
    reportGap("feature", String(key ?? entry.type), ctx.context);
    return null;
  }

  const level = ctx.headingLevel ?? 3;

  /*
   * Anchored here, because this is the only place a cited feature is drawn.
   * It is dropped from the flat list so it is not printed twice, so without
   * this it has no id anywhere — and an inbound `{@subclassFeature}` link would
   * name a fragment the page does not carry and land at the top instead.
   */
  return (
    <Box
      id={feature.anchorId}
      scrollMarginTop={feature.anchorId ? "4rem" : undefined}
    >
      <SubHeading
        level={level}
        tier={ctx.headingTier ?? tierFor(level)}
        first={first}
      >
        {feature.name}
      </SubHeading>
      <Entries
        entries={feature.entries as Entry[] | undefined}
        {...under(ctx, feature.name)}
      />
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
 * spellcasting feature granted, which the books write as `spellcasting`.
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
    <FormulaLine>
      <Text as="span" fontWeight="semibold">
        {label}
      </Text>
      {" = "}
      {dc ? "8 + " : ""}your proficiency bonus + your {ability} modifier
    </FormulaLine>
  );
}

/**
 * The third of the ability entries, and the one that states its formula rather
 * than deriving it: the PHB's passive check total, "10 + all modifiers that
 * normally apply to the check".
 *
 * One occurrence in all the books, and it shares the box with the other two
 * because it is the same kind of thing — a line to copy onto a sheet, set apart
 * from the paragraph that introduces it.
 */
function AbilityGeneric({
  entry,
  ctx,
}: {
  entry: AbilityGenericEntry;
  ctx: RenderContext;
}) {
  if (!entry.text) return null;

  return <FormulaLine>{inline(entry.text, ctx)}</FormulaLine>;
}

/** The box the three ability entries share. */
function FormulaLine({ children }: { children: ReactNode }) {
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
      {children}
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
    <Stack gap="2.5" mt="2" pl="4" borderLeftWidth="1px" borderColor="border">
      {entry.entries.map((child, index) => (
        <EntryNode key={index} entry={child} first={index === 0} {...ctx} />
      ))}
    </Stack>
  );
}

/**
 * One optional feature, printed where it is offered rather than linked away to.
 *
 * The bodies arrive through the render context because a page loads all of them
 * in one query — a Warlock's page resolves 54 invocations. Without them the
 * option still prints its name, which is what the books themselves give: a page
 * that silently drops the name would leave a feature saying "choose one of the
 * following" above nothing at all.
 */
function OptionBlock({
  entry,
  ctx,
  first,
}: {
  entry: RefOptionalFeatureEntry;
  ctx: RenderContext;
  first?: boolean;
}) {
  const key = optionalFeatureKey(entry.optionalfeature);
  const option = key ? ctx.options?.[key] : undefined;

  if (!option) {
    reportGap("option", entry.optionalfeature, ctx.context);
    return <RunInLabel>{entry.optionalfeature.split("|")[0]}</RunInLabel>;
  }

  return <OptionBody option={option} first={first} {...ctx} />;
}

/**
 * An option's name, what it requires, and what it does.
 *
 * Exported because a class page prints whole lists of these directly — the ones
 * no feature names — and they have to look the same as the ones a feature does.
 */
export function OptionBody({
  option,
  first,
  ...ctx
}: { option: OptionalFeatureBody; first?: boolean } & RenderContext) {
  const level = ctx.headingLevel ?? 3;

  return (
    <Box>
      {/* The prerequisite rides inside the heading, so an option still reads as
          one line: what it is called, then what it costs. */}
      <SubHeading
        level={level}
        tier={ctx.headingTier ?? tierFor(level)}
        first={first}
      >
        {option.name}
        {option.prerequisite ? (
          <Text
            as="span"
            fontFamily="body"
            fontSize="sm"
            fontStyle="italic"
            fontWeight="normal"
            color="fg.muted"
            ml="2"
          >
            Prerequisite: {option.prerequisite}
          </Text>
        ) : null}
      </SubHeading>
      <Entries
        entries={option.entries as Entry[] | undefined}
        {...under(ctx, option.name)}
      />
    </Box>
  );
}

/**
 * The period that closes a run-in label, which the data leaves to the renderer:
 * a label says `nameDot: false` when its name runs on into the sentence, and a
 * couple of thousand names carry their own punctuation already.
 */
function labelDot(name: string, nameDot?: boolean): string {
  if (nameDot === false) return "";
  return /[.!?:]$/.test(name.trimEnd()) ? "" : ".";
}

/**
 * A labelled item: "Name. description" — the data's definition-list shape.
 *
 * The label runs into its sentence, which is what the books print. It only
 * becomes a heading where it cannot run into anything: a label whose body opens
 * with a list or a table already lands on a line of its own, and left as a
 * run-in it sits flush against the block underneath with nothing to say the two
 * belong together.
 */
function ItemBlock({
  entry,
  ctx,
  first,
}: {
  entry: ItemEntry;
  ctx: RenderContext;
  first?: boolean;
}) {
  const body = entry.entries ?? (entry.entry != null ? [entry.entry] : []);
  const opensWithBlock =
    body.length > 0 &&
    typeof body[0] !== "string" &&
    typeof body[0] !== "number";
  const level = ctx.headingLevel ?? 3;

  return (
    <Box>
      {entry.name && opensWithBlock ? (
        <SubHeading
          level={level}
          tier={ctx.headingTier ?? tierFor(level)}
          first={first}
        >
          {inline(entry.name, ctx)}
        </SubHeading>
      ) : entry.name ? (
        <RunInLabel>
          {inline(entry.name, ctx)}
          {labelDot(entry.name, entry.nameDot)}{" "}
        </RunInLabel>
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
          /*
           * Named context only where the name was set as a heading. The other
           * branch is a run-in label — "**Fire.** The blade ignites" — which is
           * the first words of a sentence rather than something a block sits
           * under, and naming a region after it would read as a fragment.
           */
          <EntryNode
            key={index}
            entry={child}
            {...(opensWithBlock ? under(ctx, entry.name) : ctx)}
          />
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

  // `colLabels` is one row of headings and `colLabelRows` several; a table
  // carries one or the other, never both.
  const headerRows: (Entry | CellHeaderEntry)[][] = entry.colLabels?.length
    ? [entry.colLabels]
    : (entry.colLabelRows ?? []);

  const columns = Math.max(
    ...headerRows.map(headerWidth),
    ...entry.rows.map((row) => cellsOf(row).length),
  );
  const styles = columnStyles(entry.colStyles, columns);
  const sized = styles.some((style) => style.width);

  /*
   * The headings, as plain text, for the two questions that need them: whether
   * there is a real header row at all, and whether it names the first column.
   * Both were assumed before, and the activity-page word searches — fifteen
   * columns of single letters with no headings — were given a sticky heading
   * row that did not exist and a row identity made out of the first letter.
   */
  const headerText = headerRows.map((row) =>
    headerCells(row).map((cell) => ({
      ...cell,
      text: cell.label == null ? "" : String(cell.label).trim(),
    })),
  );

  /*
   * A heading over one column at the inline start is what makes that column the
   * row's name. Looked for in every header row rather than only the last: the
   * terrain tables put "Encounter" above a group row that leaves the same
   * column blank, and taking the last row alone lost the identity.
   */
  const namesFirstColumn = headerText.some((row) =>
    row.some((cell) => cell.column === 0 && cell.span === 1 && cell.text),
  );

  // The lowest row that says anything, which is the one nearest the data.
  const headings =
    [...headerText]
      .reverse()
      .find((row) => row.some((cell) => cell.text))
      ?.map((cell) => cell.text) ?? [];

  const presentation = tablePresentation({
    columns,
    rows: entry.rows.length,
    header: headings.length > 0,
    namesFirstColumn,
  });

  /*
   * What each column may be squeezed to, from what it holds.
   *
   * Read off the cells the renderer already has. A cell it cannot reduce to
   * text — a nested entry, an image — comes through as null and keeps the
   * column at prose width, which is the safe way to be wrong.
   */
  const roles = Array.from({ length: columns }, (_, column) =>
    columnRole(
      entry.rows!.map((row) => {
        const cell = cellsOf(row)[column];
        if (cell === undefined || cell === null) return "";
        if (isCell(cell)) return rollLabel(cell);
        return typeof cell === "string" ? cell : null;
      }),
      styles[column]?.share,
    ),
  );

  // A column that names its rows is that width whatever its cells look like.
  if (presentation.rowHeader === "first") roles[0] = "rowHeader";

  const minWidths = columnMinWidths(roles, presentation.width);

  /*
   * Every captioned table is anchored, not only the ones something points at.
   * An `{@area}` is gated on that, because the books hang 55,969 ids and a page
   * would otherwise carry an anchor per paragraph — but a chapter holds a
   * handful of tables, so marking them all costs nothing and saves asking which
   * of them are cited from other books.
   */
  return (
    <TableFrame
      presentation={presentation}
      anchorId={entry.caption ? tableAnchorId(entry.caption) : undefined}
      caption={entry.caption ? inline(entry.caption, ctx) : undefined}
      label={tableLabel({
        // Nothing a screen reader is handed may still be markup.
        caption: entry.caption ? plainText(entry.caption) : undefined,
        section: ctx.sectionName ?? ctx.context,
        headings: headings.map(plainText),
      })}
      footnotes={
        entry.footnotes?.length ? (
          <TableFootnotes notes={entry.footnotes} ctx={ctx} />
        ) : undefined
      }
    >
      <Table.Root
        size="sm"
        variant="line"
        /*
         * A table with nothing in it that stretches does not need to fill the
         * line. The two word-search grids are fifteen columns of one letter,
         * and filling the breakout made each square 76px of nothing.
         */
        width={roles.every((role) => role === "token") ? "auto" : "100%"}
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

        {headerRows.length ? (
          <Table.Header>
            {headerRows.map((labels, rowIndex) => (
              <Table.Row key={rowIndex} bg="bg.muted">
                {headerCells(labels).map(({ label, column, span }, index) => (
                  <Table.ColumnHeader
                    key={index}
                    colSpan={span > 1 ? span : undefined}
                    fontFamily="ui"
                    fontSize="xs"
                    fontWeight="semibold"
                    // A long heading wraps. Holding it on one line makes it the
                    // column's minimum width, which is how "Saving Throw
                    // Proficiencies" came to be wider than the sentence beside it.
                    whiteSpace={
                      span === 1 && styles[column]?.noWrap
                        ? "nowrap"
                        : undefined
                    }
                    minW={span === 1 ? minWidths[column] : undefined}
                    data-row-header={
                      presentation.rowHeader === "first" &&
                      column === 0 &&
                      span === 1
                        ? ""
                        : undefined
                    }
                    // A heading over several columns sits over the middle of
                    // them; one over a single column takes that column's own
                    // alignment.
                    textAlign={span > 1 ? "center" : styles[column]?.align}
                  >
                    {label == null ? null : inline(String(label), ctx)}
                  </Table.ColumnHeader>
                ))}
              </Table.Row>
            ))}
          </Table.Header>
        ) : null}

        <Table.Body>
          {entry.rows.map((row, rowIndex) => (
            <Table.Row key={rowIndex}>
              {cellsOf(row).map((cell, cellIndex) => (
                <Table.Cell
                  key={cellIndex}
                  /*
                   * Where a heading names the first column, that column says
                   * which row you are reading: it is the row's heading, and
                   * it stays put while the rest scrolls past it.
                   */
                  {...(presentation.rowHeader === "first" && cellIndex === 0
                    ? { as: "th" as const, scope: "row", "data-row-header": "" }
                    : {})}
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
                  minW={minWidths[cellIndex]}
                  // The equipment tables group their rows under a plain row of
                  // headings — "Light Armor" — and indent what belongs to it.
                  ps={
                    indentsFirstCell(row) && cellIndex === 0 ? "6" : undefined
                  }
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
    </TableFrame>
  );
}

/** How many columns a header row covers, spanning cells included. */
function headerWidth(row: (Entry | CellHeaderEntry)[]): number {
  return row.reduce<number>(
    (total, cell) => total + (isCellHeader(cell) ? (cell.width ?? 1) : 1),
    0,
  );
}

/**
 * A header row's cells, each with the column it starts at — which is not its
 * position in the row once a cell spans more than one column.
 */
function headerCells(row: (Entry | CellHeaderEntry)[]) {
  let column = 0;

  return row.map((cell) => {
    const span = isCellHeader(cell) ? (cell.width ?? 1) : 1;
    const at = column;
    column += span;
    return { label: isCellHeader(cell) ? cell.entry : cell, column: at, span };
  });
}

/**
 * The notes printed under a table, keyed to its cells by asterisk. Set smaller
 * and apart, as print sets them; they are entries, so their tags stay live.
 */
function TableFootnotes({
  notes,
  ctx,
}: {
  notes: Entry[];
  ctx: RenderContext;
}) {
  return (
    <Stack gap="1" mt="1.5">
      {notes.map((note, index) =>
        typeof note === "string" || typeof note === "number" ? (
          <Text
            key={index}
            className="prose"
            fontFamily="body"
            fontSize="xs"
            lineHeight="1.5"
            color="fg.muted"
          >
            {inline(String(note), ctx)}
          </Text>
        ) : (
          // One footnote in the books is a whole `entries` block rather than a
          // sentence, and goes back through the renderer.
          <EntryNode key={index} entry={note} {...ctx} />
        ),
      )}
    </Stack>
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
  first,
}: {
  entry: TableGroupEntry;
  ctx: RenderContext;
  first?: boolean;
}) {
  if (!entry.tables?.length) return null;

  const level = ctx.headingLevel ?? 3;

  return (
    <Box
      id={entry.name ? tableAnchorId(entry.name) : undefined}
      scrollMarginTop={entry.name ? "4rem" : undefined}
    >
      {entry.name ? (
        <SubHeading
          level={level}
          tier={ctx.headingTier ?? tierFor(level)}
          first={first}
        >
          {inline(entry.name, ctx)}
        </SubHeading>
      ) : null}
      <Stack gap="3">
        {entry.tables.map((table, index) => (
          <TableBlock key={index} entry={table} ctx={under(ctx, entry.name)} />
        ))}
      </Stack>
    </Box>
  );
}

/**
 * An image in prose, as a link that opens it at a readable size.
 *
 * A real anchor to the full-size file, which `ImageViewer` catches on the way
 * up — the same arrangement as `AsideLinks` and for the same reason. It is
 * reachable from the keyboard without the viewer inventing focus handling, it
 * works before the script has hydrated, and a middle click still puts the map
 * in its own tab.
 *
 * An image the data gives no path for has nothing to open and stays a picture.
 */
function Zoomable({
  image,
  entityName,
  wide,
  children,
}: {
  image: ImageEntry;
  entityName: string;
  /** Landscape art runs the column; the rest is only as wide as it is. */
  wide?: boolean;
  children: ReactNode;
}) {
  const attrs = zoomAttrs(image, entityName);
  const width = wide ? "100%" : "auto";

  if (!attrs) {
    return (
      <Box w={width} maxW="100%">
        {children}
      </Box>
    );
  }

  return (
    <Box
      asChild
      display="block"
      w={width}
      maxW="100%"
      cursor="zoom-in"
      rounded="l1"
      _focusVisible={{ outlineWidth: "2px", outlineOffset: "2px" }}
    >
      <a
        aria-label={`View ${image.title ?? image.altText ?? entityName} at full size`}
        {...attrs}
      >
        {children}
      </a>
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
      <Zoomable image={entry} entityName={ctx.context ?? ""} wide={wide}>
        <Illustration
          image={entry}
          entityName={ctx.context ?? ""}
          maxHeight={wide ? 420 : 520}
          sizes="(max-width: 48em) 100vw, 36rem"
        />
      </Zoomable>
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
      {/*
        A gallery renders its images itself rather than handing them back to
        `EntryNode`, so it has to mark them itself too — the maps three
        `{@area}` tags point at are all inside one.
      */}
      {entry.images.map((image, index) => (
        <Anchored
          key={image.href?.path ?? index}
          id={areaAnchor((image as { id?: unknown }).id, ctx)}
        >
          <Zoomable image={image} entityName={ctx.context ?? ""}>
            <Illustration
              image={image}
              entityName={ctx.context ?? ""}
              maxHeight={320}
              sizes="(max-width: 48em) 100vw, 18rem"
            />
          </Zoomable>
        </Anchored>
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
 * A creature's spellcasting, which the books store as structure rather than
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
      {entry.name ? <RunInLabel>{inline(entry.name, ctx)} </RunInLabel> : null}

      {/* Inline with the name, so the trait opens as one sentence. */}
      {entry.headerEntries?.length ? (
        <Text as="span" className="prose" fontFamily="body" lineHeight="1.65">
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
      <Entries entries={entry.entries} {...under(ctx, entry.name)} />
    </Box>
  );
}

/**
 * An adventure's shape: the steps it runs through, in order.
 *
 * Print draws these as boxes joined by arrows, laid out across a page. A
 * reading column has no width for that and no need of it — the arrows all point
 * one way — so the boxes stack and a short rule stands between them to say that
 * one follows the next. Nothing is lost but the geometry.
 *
 * The blocks go back through `Entries` rather than being rendered here, because
 * a block's own contents are ordinary prose and lists.
 */
function Flowchart({
  entry,
  ctx,
}: {
  entry: FlowchartEntry;
  ctx: RenderContext;
}) {
  const blocks = entry.blocks ?? [];
  if (blocks.length === 0) return null;

  return (
    <Stack gap="0" align="stretch">
      {blocks.map((block, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <Box
              aria-hidden="true"
              alignSelf="center"
              w="1px"
              h="4"
              bg="border.emphasized"
            />
          ) : null}
          <EntryNode entry={block} {...ctx} />
        </Fragment>
      ))}
    </Stack>
  );
}

/**
 * One step of a flowchart. 83 of the 115 are named; the rest are a paragraph.
 *
 * `page` is the print page the step is described on and is deliberately not
 * rendered, as page numbers are not rendered anywhere else in the reader.
 */
function FlowBlock({
  entry,
  ctx,
}: {
  entry: FlowBlockEntry;
  ctx: RenderContext;
}) {
  return (
    <Box borderWidth="1px" borderColor="border" rounded="l1" px="4" py="3">
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
