import { Box, Text } from "@chakra-ui/react";
import { Entries, type Entry } from "@/components/entry";
import type { ReferenceIndex } from "@/lib/content/references";

/**
 * What an object does back.
 *
 * 13 of the 20 objects are siege weapons and other things that attack, and they
 * keep those attacks in `actionEntries` — a sibling of `entries`, not part of
 * it — so the panel prints nothing for them unless something reaches for it.
 * Two objects have no `entries` at all and are *only* this.
 *
 * Each action is reshaped into the renderer's `item` form before it is handed
 * over, exactly as the creature stat block does with its own: the stored shape
 * is `{name, type: "actions", entries}`, and `actions` is not an entry type the
 * renderer knows — passed as stored, every one of them would render as an
 * unsupported block and report a coverage gap.
 */
export function ObjectActions({
  actions,
  refs,
  selfKey,
  context,
}: {
  actions: unknown;
  refs: ReferenceIndex;
  selfKey: string;
  context: string;
}) {
  if (!Array.isArray(actions) || actions.length === 0) return null;

  const items: Entry[] = actions.map((action) => {
    const { name, entries } = action as { name?: string; entries?: Entry[] };
    return { type: "item", name, entries: entries ?? [] };
  });

  return (
    <Box>
      <Text
        as="h2"
        fontFamily="display"
        fontSize="md"
        letterSpacing="tight"
        borderBottomWidth="1px"
        borderColor="border.emphasized"
        pb="0.5"
        mb="2"
      >
        Actions
      </Text>

      <Entries entries={items} refs={refs} selfKey={selfKey} context={context} />
    </Box>
  );
}
