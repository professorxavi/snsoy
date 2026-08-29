import { Box, Text } from "@chakra-ui/react";
import {
  abilitySpreads,
  formatAbilityBonuses,
  formatSize,
  formatSpeed,
} from "@/lib/content/races";
import type { RaceDetail, SubraceDetail } from "@/server/db/queries/races";

/**
 * Size, speed and ability bonuses — the three numbers that characterise a race.
 *
 * Shared by the race page, its subrace disclosures and the aside, so a race
 * summarised in a 400px panel says exactly what the page says. Takes a subrace
 * as readily as a race: a subrace overrides some of the same three.
 */
export function TraitSummary({
  race,
  borderTop = true,
}: {
  race: RaceDetail | SubraceDetail;
  borderTop?: boolean;
}) {
  const parts = [
    { label: "Size", value: formatSize(race.size) },
    { label: "Speed", value: formatSpeed(race.speed) },
    {
      label: "Ability Scores",
      // Its own spread, or the lineage rule where the race defers to it.
      value: formatAbilityBonuses(abilitySpreads(race)),
    },
  ].filter((part) => part.value && part.value !== "—");

  if (parts.length === 0) return null;

  return (
    <Box
      display="flex"
      flexWrap="wrap"
      columnGap="5"
      rowGap="1"
      mt={borderTop ? "3" : "0"}
      pt={borderTop ? "3" : "0"}
      borderTopWidth={borderTop ? "1px" : "0"}
      borderColor="border"
    >
      {parts.map((part) => (
        <Box key={part.label}>
          <Text
            as="span"
            fontFamily="ui"
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="wide"
            textTransform="uppercase"
            color="fg.subtle"
            mr="1.5"
          >
            {part.label}
          </Text>
          <Text as="span" fontFamily="body" fontSize="sm">
            {part.value}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
