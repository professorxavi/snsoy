import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { Entries, type Entry } from "@/components/entry";
import type { ReferenceIndex } from "@/lib/content/references";
import { checkName } from "@/lib/content/skills";
import { sourceHref } from "@/lib/routes";
import type { SkillDetail } from "@/server/db/queries/skills";

/**
 * A skill in the aside — which is the only place a skill is ever rendered.
 *
 * The class and race asides summarise, because their pages carry more than a
 * 400px column can hold. This one does not: a skill is two paragraphs at the
 * longest, so the panel prints the whole of it and there is nowhere else to go.
 * That is also why there is no "open full page" link and no skill page behind
 * it — a document this short would be a page with one paragraph on it, reached
 * by leaving whatever the reader was actually reading.
 */
export function SkillAside({
  skill,
  refs,
}: {
  skill: SkillDetail;
  refs: ReferenceIndex;
}) {
  const data = skill.data as { entries?: Entry[] };

  return (
    <Stack gap="4" px="4" py="4">
      <Box>
        <Text
          fontFamily="ui"
          fontSize="2xs"
          fontWeight="medium"
          letterSpacing="widest"
          textTransform="uppercase"
          color="fg.subtle"
        >
          <Box asChild _hover={{ color: "brand" }}>
            <NextLink href={sourceHref(skill.sourceId)}>
              {skill.sourceName}
            </NextLink>
          </Box>
          {skill.page ? ` · p. ${skill.page}` : null}
        </Text>

        <Text
          as="h1"
          fontFamily="display"
          fontSize="2xl"
          lineHeight="1.05"
          letterSpacing="tight"
          textWrap="balance"
          mt="1"
        >
          {skill.name}
        </Text>

        {/* The ability, in the form the rules write a check: "Wisdom
            (Perception)". Says what to roll before the prose says when. */}
        <Text
          fontFamily="body"
          fontStyle="italic"
          fontSize="sm"
          color="fg.muted"
          mt="1"
        >
          {checkName(skill.ability, skill.name)}
        </Text>
      </Box>

      <Entries
        entries={data.entries}
        refs={refs}
        selfKey={skill.naturalKey}
        context={skill.name}
      />
    </Stack>
  );
}
