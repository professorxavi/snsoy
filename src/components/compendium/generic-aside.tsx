import { Stack, Text } from "@chakra-ui/react";
import { Entries, type Entry } from "@/components/entry";
import { AsideIdentity } from "@/components/compendium/aside-identity";
import type { ReferenceIndex } from "@/lib/content/references";

export interface ShortRuleEntity {
  naturalKey: string;
  name: string;
  sourceId: string;
  sourceName: string;
  page: number | null;
  data: unknown;
}

/**
 * A short rule in the aside, rendered in full because it has no page behind it.
 *
 * The bargain the skill and condition asides already struck, made once. Each of
 * these types is short enough to print entire, which is the reason none of them
 * was given a page: reading what Blindsight means should cost nothing more than
 * the glance it takes, least of all the page you met the word on. So there is no
 * "open full page" link here — there is nowhere else to go.
 *
 * The optional subtitle carries a type's one extra fact, such as a skill's
 * check or an action's time.
 */
export function GenericAside({
  entity,
  refs,
  subtitle,
}: {
  entity: ShortRuleEntity;
  refs: ReferenceIndex;
  /** One line under the name, where the type has a second fact worth stating. */
  subtitle?: string | null;
}) {
  const data = entity.data as { entries?: Entry[] };

  return (
    <Stack gap="4" px="4" py="4">
      <AsideIdentity
        sourceId={entity.sourceId}
        sourceName={entity.sourceName}
        page={entity.page}
        name={entity.name}
      >
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
      </AsideIdentity>

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
