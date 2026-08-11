import { Stack, Text } from "@chakra-ui/react";
import { Inline } from "@/components/entry";
import type { ReferenceIndex } from "@/lib/content/references";

/**
 * The short labelled facts a type keeps beside its prose.
 *
 * Three of the lore types print most of what they know this way rather than in
 * `entries`: a cult's goal and its typical cultists, a boon's ability, a god's
 * alignment, domains and symbol. Left to `entries` alone the panel would open a
 * deity showing a name and, for 320 of the 494, nothing else at all.
 *
 * The text goes through `Inline` rather than being printed flat, because a
 * signature spell list is written as `{@spell hex}` and is one of the better
 * places in the compendium to be able to open what it names.
 */
export function LabelledLines({
  lines,
  refs,
  selfKey,
  context,
}: {
  /** Rendered in order; anything with no text is dropped. */
  lines: { label: string; text?: string | null }[];
  refs: ReferenceIndex;
  selfKey?: string;
  context?: string;
}) {
  const present = lines.filter((line) => line.text);
  if (present.length === 0) return null;

  return (
    <Stack gap="1">
      {present.map((line) => (
        <Text key={line.label} fontFamily="body" fontSize="sm" lineHeight="1.55">
          <Text as="span" fontWeight="semibold">
            {line.label}
          </Text>{" "}
          <Inline
            text={line.text!}
            refs={refs}
            selfKey={selfKey}
            context={context}
          />
        </Text>
      ))}
    </Stack>
  );
}
