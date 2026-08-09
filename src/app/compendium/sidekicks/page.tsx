import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { casterLabel, formatAbilities } from "@/lib/content/classes";
import { hrefFor } from "@/lib/routes";
import {
  listSidekicks,
  type SidekickListItem,
} from "@/server/db/queries/classes";

export const metadata: Metadata = {
  title: "Sidekicks",
  description: "The three companion classes, for a party that needs a fourth.",
};

/**
 * The sidekicks.
 *
 * They are `class` rows and they open on the class reader, because a sidekick
 * is built exactly like a class — twenty levels, a progression table, features.
 * What they are not is something a player rolls up, so they are listed apart
 * from the twelve rather than sitting among them under the same heading.
 *
 * The rows link to the class route, which is where a sidekick's page has always
 * been and where an inbound link from book text still points. A second segment
 * for the same entity type would be a second URL for one page.
 */
export default async function SidekicksPage() {
  const sidekicks = await listSidekicks();

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
            Sidekicks
          </Heading>
          <Text
            className="prose"
            fontFamily="body"
            fontSize="md"
            lineHeight="1.65"
            color="fg.muted"
          >
            A creature a small party takes along and levels up beside them.
            Each one is built like a class, over the same twenty levels, and
            reads the same way.
          </Text>
        </Stack>

        <Stack gap="0">
          {sidekicks.map((sidekick) => (
            <SidekickRow key={sidekick.id} sidekick={sidekick} />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

function SidekickRow({ sidekick }: { sidekick: SidekickListItem }) {
  const href = hrefFor({
    entityType: "class",
    sourceId: sidekick.sourceId,
    slug: sidekick.slug,
  });

  // Two of the three carry no hit die or saves at all, so this line is often
  // just the book — which is still worth printing, and better than a blank.
  const summary = [
    sidekick.hitDie ? `d${sidekick.hitDie}` : null,
    formatAbilities(sidekick.savingThrows),
    casterLabel(sidekick.casterProgression),
    sidekick.sourceName,
  ].filter(Boolean);

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
          {sidekick.name}
        </Text>
        <Text fontFamily="ui" fontSize="xs" color="fg.muted" lineHeight="1.5">
          {summary.join(" · ")}
        </Text>
      </NextLink>
    </Box>
  );
}
