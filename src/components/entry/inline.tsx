import { Box, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import {
  areaTargetForTag,
  candidateKeysForTag,
  EMPTY_AREAS,
  EMPTY_REFERENCES,
  FORMAT_TAGS,
  kindOfTag,
  labelForTag,
  lookupReference,
  type AreaIndex,
  type FormatKind,
  type ReferenceIndex,
} from "@/lib/content/references";
import { splitByTags, type TagSegment } from "@/lib/content/tags";
import { reportGap } from "./coverage";

/**
 * Renders inline `{@tag}` markup.
 *
 * Three visual treatments: cross-references are cyan and underlined, dice rolls
 * get a dotted underline (interactive, but they navigate nowhere), and emphasis
 * carries no colour. The UI accent is not used here; this is body text.
 */

export interface InlineProps {
  text: string;
  /** Resolved link targets. Absent means nothing links. */
  refs?: ReferenceIndex;
  /**
   * Natural key of the entity being rendered, so its own text does not link
   * back to the page it is on.
   */
  selfKey?: string;
  /** Entity name, used to label unsupported tags in the coverage report. */
  context?: string;
  /**
   * Where this book's numbered locations are, for `{@area}`. Only a chapter
   * page has any; everywhere else an area tag renders as plain words.
   */
  areas?: AreaIndex;
}

export function Inline({ text, refs, selfKey, context, areas }: InlineProps) {
  return (
    <>
      {renderText(
        text,
        refs ?? EMPTY_REFERENCES,
        selfKey,
        context,
        areas ?? EMPTY_AREAS,
      )}
    </>
  );
}

function renderText(
  text: string,
  refs: ReferenceIndex,
  selfKey: string | undefined,
  context: string | undefined,
  areas: AreaIndex,
): ReactNode {
  // The common case by a wide margin — skip tokenizing text with no markup.
  if (!text.includes("{@") && !text.includes("{=")) return text;

  return splitByTags(text).map((segment, index) => (
    <Segment
      key={index}
      segment={segment}
      refs={refs}
      selfKey={selfKey}
      context={context}
      areas={areas}
    />
  ));
}

function Segment({
  segment,
  refs,
  selfKey,
  context,
  areas,
}: {
  segment: TagSegment;
  refs: ReferenceIndex;
  selfKey?: string;
  context?: string;
  areas: AreaIndex;
}) {
  if (segment.kind === "text") return <>{segment.value}</>;

  const label = labelForTag(segment);

  /*
   * A label is usually one of the tag's own parts, and a part can hold more
   * markup: `{@adventure {@i Curse of Strahd}|CoS}`. Emitted as a flat string
   * the inner tag reaches the reader verbatim, so render it.
   *
   * Safe on the labels that are built rather than quoted ("Hit: ", `DC 15`),
   * because renderText returns a string with no markup in it untouched. The
   * one thing never passed through here is `segment.raw`, which would re-parse
   * this very tag and never terminate.
   */
  const rendered = renderText(label, refs, selfKey, context, areas);

  switch (kindOfTag(segment.name)) {
    case "reference": {
      const hit = lookupReference(candidateKeysForTag(segment), refs);

      // Unresolved, unaddressable, or self-referential: render as plain text.
      if (!hit || !hit.target.href || hit.key === selfKey) {
        return <>{label ? rendered : (hit?.target.name ?? "")}</>;
      }

      return (
        <CrossReference href={hit.target.href}>
          {label ? rendered : hit.target.name}
        </CrossReference>
      );
    }

    /*
     * A location inside the book — resolved to a fragment on this page, or to
     * another chapter of the same book. Unresolved ones stay plain words: an
     * anchor to an element that is not on the page scrolls nowhere and looks
     * broken, which is worse than not linking.
     */
    case "anchor": {
      const target = areaTargetForTag(segment);
      const href = target ? areas[target] : undefined;
      if (!href) return <>{rendered}</>;

      return <CrossReference href={href}>{rendered}</CrossReference>;
    }

    case "roll":
      return <Roll>{rendered}</Roll>;

    case "cue":
      return <Cue>{rendered}</Cue>;

    case "format":
      return (
        <Emphasis kind={FORMAT_TAGS[segment.name as keyof typeof FORMAT_TAGS]}>
          {renderText(segment.parts[0] ?? "", refs, selfKey, context, areas)}
        </Emphasis>
      );

    // Recognised but not actionable; render the label only.
    case "plain":
      return <>{rendered}</>;

    default:
      reportGap("tag", segment.name, context);
      return <Unsupported>{label ? rendered : segment.raw}</Unsupported>;
  }
}

/**
 * A link to another entity. Underlined as well as coloured, so it stays
 * distinguishable without colour vision.
 */
function CrossReference({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Box
      asChild
      color="reference"
      textDecoration="underline"
      textDecorationColor="reference.line"
      textUnderlineOffset="2px"
      transition="text-decoration-color .12s"
      _hover={{ textDecorationColor: "reference" }}
    >
      <NextLink href={href}>{children}</NextLink>
    </Box>
  );
}

/**
 * A die roll. Inert for now, but styled distinctly from links because it will
 * not navigate anywhere. Tabular figures so table columns line up.
 */
function Roll({ children }: { children: ReactNode }) {
  return (
    <Text
      as="span"
      color="roll"
      fontVariantNumeric="tabular-nums"
      whiteSpace="nowrap"
      textDecoration="underline"
      textDecorationStyle="dotted"
      textDecorationColor="roll.line"
      textUnderlineOffset="2px"
    >
      {children}
    </Text>
  );
}

/**
 * "Melee Weapon Attack:", "Hit:" — the labels that structure an attack rather
 * than form part of its sentence.
 *
 * Bold italic and no colour, exactly as the books set them. They are frequent
 * enough in a stat block that anything louder would stripe the whole panel, and
 * a reader scanning for the damage line finds it by these.
 */
function Cue({ children }: { children: ReactNode }) {
  return (
    <Text as="strong" fontStyle="italic" fontWeight="semibold">
      {children}
    </Text>
  );
}

function Emphasis({
  kind,
  children,
}: {
  kind: FormatKind;
  children: ReactNode;
}) {
  switch (kind) {
    case "bold":
      return (
        <Text as="strong" fontWeight="semibold">
          {children}
        </Text>
      );
    case "italic":
      return <Text as="em">{children}</Text>;
    case "underline":
      return <Text as="u">{children}</Text>;
    case "strike":
      return <Text as="s">{children}</Text>;
    case "highlight":
      return (
        <Text as="mark" bg="reference.subtle" color="fg" px="0.5">
          {children}
        </Text>
      );
    // An authorial aside, not part of the rule.
    case "note":
      return (
        <Text as="em" color="fg.muted">
          {children}
        </Text>
      );

    /*
     * A speech balloon, and deliberately unmarked. The commentary already sits
     * in a panel of its own and the lettering levels carry the voice, so a
     * rule here bought nothing: it marked the lines the books wrapped in
     * `{@comic}` and left the ones wrapped in `{@comicH1}` bare, which tracks
     * the markup rather than anything a reader can see.
     *
     * It stays a format tag so that what is inside it renders at all, and so
     * it is classified rather than reported as a gap.
     */
    case "comicVoice":
      return <>{children}</>;

    // A word leant on mid-sentence — "you get to be a god, Morty".
    case "comicStress":
      return (
        <Text as="strong" fontWeight="semibold">
          {children}
        </Text>
      );

    // A raised voice, usually a whole line. The slab face in a short run.
    case "comicShout":
      return (
        <Text as="strong" fontFamily="display" fontWeight="normal">
          {children}
        </Text>
      );

    /*
     * The loudest the books get, and always already wrapped in bold italic.
     * The slab face has one weight and no italic, so those would synthesise a
     * smeared oblique; reset them and let the face and the size carry it.
     */
    case "comicRoar":
      return (
        <Text
          as="strong"
          fontFamily="display"
          fontWeight="normal"
          fontStyle="normal"
          fontSize="1.15em"
          textTransform="uppercase"
          lineHeight="1"
        >
          {children}
        </Text>
      );

    /*
     * A note pencilled beside the line, most often Rick rating a spell:
     * "Magic Missile YES, POKE". Short, and uppercase and tracked in the UI
     * face, which is what the brief reserves that treatment for.
     */
    case "comicNote":
      return (
        <Text
          as="span"
          fontFamily="ui"
          fontSize="xs"
          textTransform="uppercase"
          letterSpacing="wider"
          color="fg.subtle"
          whiteSpace="nowrap"
        >
          {children}
        </Text>
      );
  }
}

/** Fallback for unknown tags. Deliberately conspicuous so gaps get noticed. */
function Unsupported({ children }: { children: ReactNode }) {
  return (
    <Text
      as="span"
      bg="marque/15"
      color="marque"
      borderBottomWidth="1px"
      borderBottomStyle="dashed"
      borderColor="marque"
      px="0.5"
    >
      {children}
    </Text>
  );
}
