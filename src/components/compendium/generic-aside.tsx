import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { Entries, type Entry } from "@/components/entry";
import type { ReferenceIndex } from "@/lib/content/references";
import { sourceHref } from "@/lib/routes";
import type { GenericEntity } from "@/server/db/queries/generic";

/**
 * A `generic_entities` row in the aside — which is the only place these types
 * are ever rendered.
 *
 * The bargain the skill and condition asides already struck, made once. Each of
 * these types is short enough to print entire, which is the reason none of them
 * was given a page: reading what Blindsight means should cost nothing more than
 * the glance it takes, least of all the page you met the word on. So there is no
 * "open full page" link here — there is nowhere else to go.
 *
 * The only per-type difference is the subtitle. A skill states the check it
 * rolls, an action how long it takes; a condition has no second fact about it
 * and passes nothing.
 */
export function GenericAside({
  entity,
  refs,
  subtitle,
}: {
  entity: GenericEntity;
  refs: ReferenceIndex;
  /** One line under the name, where the type has a second fact worth stating. */
  subtitle?: string | null;
}) {
  const data = entity.data as { entries?: Entry[] };

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
            <NextLink href={sourceHref(entity.sourceId)}>
              {entity.sourceName}
            </NextLink>
          </Box>
          {entity.page ? ` · p. ${entity.page}` : null}
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
          {entity.name}
        </Text>

        {subtitle ? (
          <Text
            fontFamily="body"
            fontStyle="italic"
            fontSize="sm"
            color="fg.muted"
            mt="1"
          >
            {subtitle}
          </Text>
        ) : null}
      </Box>

      {/*
        Tags inside the entry are live, so the aside stacks one entity on the
        next and back returns to what sent you. It is what these types are for:
        an action that says you become {@condition prone} should get you there
        without leaving the fight you were reading about.
      */}
      <Entries
        entries={data.entries}
        refs={refs}
        selfKey={entity.naturalKey}
        context={entity.name}
      />
    </Stack>
  );
}
