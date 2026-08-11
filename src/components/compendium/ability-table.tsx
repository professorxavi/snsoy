import { Box, Text } from "@chakra-ui/react";
import { abilityScores, type Ability } from "@/lib/content/monsters";

/**
 * The six ability scores, each with the modifier derived from it.
 *
 * Six columns even at 400px. It is the one part of a stat block that is a table
 * in print, read across rather than down, and stacking it into pairs to save
 * width would break the scan it exists to support.
 *
 * Shared by the creatures and the vehicles, which is the whole of what those
 * two stat blocks have in common: 14 of the 35 vehicles carry scores, and a
 * war machine's Strength is read exactly as a creature's is.
 */
export function AbilityTable({
  data,
}: {
  data: Partial<Record<Ability, number>>;
}) {
  const scores = abilityScores(data);

  // A handful of stat blocks — templates, mostly — carry no scores at all.
  if (scores.every((entry) => entry.score == null)) return null;

  return (
    <Box
      display="grid"
      gridTemplateColumns="repeat(6, minmax(0, 1fr))"
      gap="1"
      bg="bg.sunken"
      px="2"
      py="2"
      rounded="l1"
    >
      {scores.map((entry) => (
        <Box key={entry.ability} textAlign="center">
          <Text
            fontFamily="ui"
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="wide"
            textTransform="uppercase"
            color="fg.subtle"
          >
            {entry.ability}
          </Text>
          <Text
            fontFamily="body"
            fontSize="sm"
            fontVariantNumeric="tabular-nums"
            lineHeight="1.3"
          >
            {entry.score ?? "—"}
          </Text>
          <Text
            fontFamily="body"
            fontSize="xs"
            fontVariantNumeric="tabular-nums"
            color="fg.muted"
            lineHeight="1.2"
          >
            {entry.modifier ? `(${entry.modifier})` : ""}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
