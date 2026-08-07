import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import {
  formatAbilityBonuses,
  formatSize,
  formatSpeed,
} from "@/lib/content/races";
import { hrefFor } from "@/lib/routes";
import { listRacesBySource, type RaceListItem } from "@/server/db/queries/races";

export const metadata: Metadata = {
  title: "Races",
  description: "Every ancestry, grouped by the book that printed it.",
};

/**
 * The races landing page.
 *
 * Not the spells table, and not the aside. A race is not a row of comparable
 * values — it is a small document with traits and, often, a shelf of subraces —
 * so clicking one navigates to a reading page rather than opening a panel.
 *
 * Grouped by source rather than sorted A–Z: "the Player's Handbook ones" is how
 * people actually reach for a race, and a flat list would bury the nine
 * everyone knows among 125 they do not.
 */
export default async function RacesPage() {
  const groups = await listRacesBySource();

  return (
    <Box
      as="main"
      id="main"
      px={{ base: "5", md: "10" }}
      py={{ base: "10", md: "14" }}
      pb="24"
    >
      <Box maxW="5xl" mx="auto">
        <Stack gap="3" maxW="measure" mb={{ base: "10", md: "12" }}>
          <Heading
            as="h1"
            fontFamily="display"
            fontWeight="normal"
            fontSize={{ base: "3xl", md: "4xl" }}
            lineHeight="1.05"
            letterSpacing="tight"
          >
            Races
          </Heading>
          <Text
            className="prose"
            fontFamily="body"
            fontSize="md"
            lineHeight="1.65"
            color="fg.muted"
          >
            Every ancestry from the books you own. Subraces live on their
            parent&rsquo;s page, alongside the traits they build on.
          </Text>
        </Stack>

        <Stack gap={{ base: "9", md: "11" }}>
          {groups.map((group) => (
            <Box as="section" key={group.sourceId}>
              <Text
                as="h2"
                fontFamily="ui"
                fontSize="2xs"
                fontWeight="semibold"
                letterSpacing="widest"
                textTransform="uppercase"
                color="fg.subtle"
                borderBottomWidth="1px"
                borderColor="border"
                pb="2"
                mb="1"
              >
                {group.sourceName}
              </Text>

              <Stack gap="0">
                {group.races.map((race) => (
                  <RaceRow key={race.id} race={race} />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

function RaceRow({ race }: { race: RaceListItem }) {
  const href = hrefFor({
    entityType: "race",
    sourceId: race.sourceId,
    slug: race.slug,
  });

  return (
    <Box
      asChild
      display="grid"
      gridTemplateColumns={{ base: "1fr", sm: "minmax(0, 14rem) minmax(0, 1fr)" }}
      alignItems="baseline"
      gap={{ base: "0.5", sm: "4" }}
      py="2.5"
      px="2"
      mx="-2"
      rounded="l1"
      borderBottomWidth="1px"
      borderColor="border"
      transition="background .1s"
      _hover={{ bg: "bg.muted" }}
    >
      <NextLink href={href ?? "#"}>
        <Text fontFamily="body" fontSize="md" fontWeight="medium" lineHeight="1.3">
          {race.name}
        </Text>
        <Text
          fontFamily="ui"
          fontSize="xs"
          color="fg.muted"
          lineHeight="1.5"
        >
          {[
            formatSize(race.size),
            formatSpeed(race.speed),
            formatAbilityBonuses(race.ability),
          ]
            .filter((part) => part && part !== "—")
            .join(" · ")}
        </Text>
      </NextLink>
    </Box>
  );
}
