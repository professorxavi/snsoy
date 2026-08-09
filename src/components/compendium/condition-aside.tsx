import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { Entries, type Entry } from "@/components/entry";
import type { ReferenceIndex } from "@/lib/content/references";
import { sourceHref } from "@/lib/routes";
import type { ConditionDetail } from "@/server/db/queries/conditions";

/**
 * A condition in the aside — which is the only place a condition is rendered.
 *
 * The same bargain the skill aside strikes. A condition is a short list of
 * consequences, so the panel prints all of it and there is no page behind it to
 * link on to: reading Grappled should cost nothing more than the glance it
 * takes, least of all the page you met the word on.
 *
 * No subtitle, unlike a skill's ability line — a condition has no second fact
 * about it, and its effects are the whole of what it is.
 */
export function ConditionAside({
  condition,
  refs,
}: {
  condition: ConditionDetail;
  refs: ReferenceIndex;
}) {
  const data = condition.data as { entries?: Entry[] };

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
            <NextLink href={sourceHref(condition.sourceId)}>
              {condition.sourceName}
            </NextLink>
          </Box>
          {condition.page ? ` · p. ${condition.page}` : null}
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
          {condition.name}
        </Text>
      </Box>

      {/*
        Conditions cite each other constantly — Stunned, Paralyzed, Petrified
        and Unconscious all open by saying the creature is incapacitated — and
        those tags are live links here, so the aside stacks one on the next and
        back returns to what sent you.
      */}
      <Entries
        entries={data.entries}
        refs={refs}
        selfKey={condition.naturalKey}
        context={condition.name}
      />
    </Stack>
  );
}
