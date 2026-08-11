import { Box, Stack, Text } from "@chakra-ui/react";
import { Inline } from "@/components/entry";
import { deckCards } from "@/lib/content/cards";
import type { ReferenceIndex } from "@/lib/content/references";

/**
 * The cards a deck deals, as live links.
 *
 * A deck is barely anything without them: most of the 31 carry a paragraph of
 * prose and then the list, and the list is what a reader came for. They are
 * stored as `name|set|source` addresses, which `deckCards` puts back into
 * `{@card}` form so they resolve through the same index as every other
 * reference, by natural key rather than by slug.
 *
 * Repeats carry a count rather than repeating the row: a Deck of Illusions
 * deals two Goblins, and printing Goblin twice says less than "Goblin ×2".
 */
export function DeckContents({
  data,
  refs,
  selfKey,
  context,
}: {
  data: { cards?: unknown };
  refs: ReferenceIndex;
  selfKey: string;
  context: string;
}) {
  const cards = deckCards(data);
  if (cards.length === 0) return null;

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
        Cards
      </Text>

      <Stack gap="0.5">
        {cards.map((card) => (
          <Text key={card.tag} fontFamily="body" fontSize="sm" lineHeight="1.55">
            <Inline
              text={card.tag}
              refs={refs}
              selfKey={selfKey}
              context={context}
            />
            {card.count > 1 ? (
              <Text as="span" color="fg.subtle">
                {` ×${card.count}`}
              </Text>
            ) : null}
          </Text>
        ))}
      </Stack>
    </Box>
  );
}
