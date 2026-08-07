import { Box, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import {
  candidateKeysForTag,
  EMPTY_REFERENCES,
  FORMAT_TAGS,
  kindOfTag,
  labelForTag,
  lookupReference,
  type FormatKind,
  type ReferenceIndex,
} from "@/lib/content/references";
import { splitByTags, type TagSegment } from "@/lib/content/tags";
import { reportGap } from "./coverage";

/**
 * Inline markup, rendered.
 *
 * This is where the design system's central idea becomes code. Body text holds
 * roughly 118,000 inline tags, and a reader has to tell three things apart at a
 * glance, mid-sentence, without stopping to think:
 *
 * - **Cross-references** are the corpus speaking. Cyan, always underlined,
 *   never a filled control — cyan means "this goes somewhere".
 * - **Rolls** (`{@damage 8d6}`, `{@hit +5}`) are interactive but navigate
 *   nowhere, so they get a third treatment rather than borrowing either voice:
 *   ink-coloured with a dotted underline. Rendering them cyan would promise a
 *   destination that does not exist.
 * - **Emphasis** carries no colour at all.
 *
 * Purple appears nowhere here on purpose. It is the app's voice — nav, buttons,
 * focus — and prose is not the app talking.
 */

export interface InlineProps {
  text: string;
  /** Resolved targets for this page. Absent means nothing links. */
  refs?: ReferenceIndex;
  /**
   * The natural key of the entity being rendered.
   *
   * A spell's own text often names the spell — `{@spell wish}` inside Wish —
   * and linking a page to itself is a dead end dressed up as navigation.
   */
  selfKey?: string;
  /** Entity name, so an unsupported tag can be reported somewhere findable. */
  context?: string;
}

export function Inline({ text, refs, selfKey, context }: InlineProps) {
  return <>{renderText(text, refs ?? EMPTY_REFERENCES, selfKey, context)}</>;
}

function renderText(
  text: string,
  refs: ReferenceIndex,
  selfKey: string | undefined,
  context: string | undefined,
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
    />
  ));
}

function Segment({
  segment,
  refs,
  selfKey,
  context,
}: {
  segment: TagSegment;
  refs: ReferenceIndex;
  selfKey?: string;
  context?: string;
}) {
  if (segment.kind === "text") return <>{segment.value}</>;

  const label = labelForTag(segment);

  switch (kindOfTag(segment.name)) {
    case "reference": {
      const hit = lookupReference(candidateKeysForTag(segment), refs);

      // Unresolved, unaddressable, or pointing at the page we are already on.
      // All three render as prose: no colour, because there is nowhere to go.
      if (!hit || !hit.target.href || hit.key === selfKey) {
        return <>{label || hit?.target.name || ""}</>;
      }

      return (
        <CrossReference href={hit.target.href}>
          {label || hit.target.name}
        </CrossReference>
      );
    }

    case "roll":
      return <Roll>{label}</Roll>;

    case "format":
      return (
        <Emphasis kind={FORMAT_TAGS[segment.name as keyof typeof FORMAT_TAGS]}>
          {renderText(segment.parts[0] ?? "", refs, selfKey, context)}
        </Emphasis>
      );

    /** Recognised, deliberately inert — render the words and move on. */
    case "plain":
      return <>{label}</>;

    default:
      reportGap("tag", segment.name, context);
      return <Unsupported>{label || segment.raw}</Unsupported>;
  }
}

/**
 * The corpus's voice.
 *
 * Underline is not decoration here, it is the redundant channel: cyan and
 * purple are both cool and converge at body size, so the distinction has to
 * survive without colour vision (WCAG 1.4.1). The line sits in a lighter tone
 * than the text and strengthens on hover, which keeps a paragraph carrying
 * thirty of these from turning into a grid.
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
      color="corpus"
      textDecoration="underline"
      textDecorationColor="corpus.line"
      textUnderlineOffset="2px"
      transition="text-decoration-color .12s"
      _hover={{ textDecorationColor: "corpus" }}
    >
      <NextLink href={href}>{children}</NextLink>
    </Box>
  );
}

/**
 * Dice. Interactive later, inert for now — but styled as its own thing from the
 * start, because retrofitting a third treatment after readers have learned two
 * is the expensive way to do it.
 *
 * Tabular figures so a column of damage values in a table lines up.
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
        <Text as="mark" bg="corpus.subtle" color="fg" px="0.5">
          {children}
        </Text>
      );
    /** An aside from the authors, not part of the rule being stated. */
    case "note":
      return (
        <Text as="em" color="fg.muted">
          {children}
        </Text>
      );
  }
}

/**
 * Visibly unhandled.
 *
 * Loud on purpose. A fallback that blends in is a fallback nobody reports, and
 * the coverage report is only useful if the gaps it lists were also seen.
 */
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
