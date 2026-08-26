import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { casterLabel, formatAbilities } from "@/lib/content/classes";
import { hrefFor } from "@/lib/routes";
import {
  listClassesBySource,
  type ClassListItem,
} from "@/server/db/queries/classes";

export const metadata: Metadata = {
  title: "Classes",
  description: "Every class, grouped by the book that printed it.",
};

/**
 * The classes landing page.
 *
 * Thirteen rows, so no filtering and no table: a class is chosen by name, and
 * the line under each one carries the three things anyone compares classes on
 * before opening them — hit die, saving throws, and whether it casts.
 */
export default async function ClassesPage() {
  const groups = await listClassesBySource();

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
            Classes
          </Heading>
          <Text
            className="prose"
            fontFamily="body"
            fontSize="md"
            lineHeight="1.65"
            color="fg.muted"
          >
            What your character can do, and when they learn it.
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
                {group.classes.map((entry) => (
                  <ClassRow key={entry.id} entry={entry} />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

function ClassRow({ entry }: { entry: ClassListItem }) {
  const href = hrefFor({
    entityType: "class",
    sourceId: entry.sourceId,
    slug: entry.slug,
  });

  const summary = [
    entry.hitDie ? `d${entry.hitDie}` : null,
    formatAbilities(entry.savingThrows),
    casterLabel(entry.casterProgression),
    entry.subclassCount > 0
      ? `${entry.subclassCount} ${(entry.subclassTitle ?? "subclass").toLowerCase()}${entry.subclassCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  return (
    <Box
      asChild
      display="grid"
      gridTemplateColumns={{ base: "1fr", sm: "minmax(0, 12rem) minmax(0, 1fr)" }}
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
          {entry.name}
        </Text>
        <Text fontFamily="ui" fontSize="xs" color="fg.muted" lineHeight="1.5">
          {summary.join(" · ")}
        </Text>
      </NextLink>
    </Box>
  );
}
