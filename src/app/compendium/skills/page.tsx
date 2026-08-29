import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import { SkillTable } from "@/components/compendium/skill-table";
import { readString, type QueryParams } from "@/lib/query-params";
import { listSkills, type SkillSort } from "@/server/db/queries/skills";

export const metadata: Metadata = {
  title: "Skills",
  description:
    "The eighteen skills, the ability each draws on, and what each one covers.",
};

/**
 * The skill browse view.
 *
 * A table with an aside, like spells, because the question a reader brings here
 * is comparative — which skill covers this, and what do I roll for it — and
 * answering it should not cost the list. Unlike spells there is nothing to
 * filter or page: eighteen rows from one book fit on one screen, so the header
 * below stands where the spell list's toolbar does.
 */
export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const sort = (readString(params, "sort") as SkillSort) ?? "name";
  const rows = await listSkills(sort);

  return (
    /*
     * Held to a column rather than the page's full width. Four narrow columns
     * stretched across a wide screen put a foot of empty space between a skill's
     * name and what it covers, and the eye has to travel it on every row.
     *
     * Centred in whatever width it is given, as the class, race and sidekick
     * indexes are. `BrowseFrame` gives the aside a grid column of its own, so
     * the room beside the table was never being held for it.
     */
    <Box
      as="main"
      id="main"
      maxW="4xl"
      mx="auto"
      px={{ base: "5", md: "8" }}
      pb="16"
    >
      <Stack
        gap="3"
        maxW="measure"
        pt={{ base: "8", md: "10" }}
        pb={{ base: "6", md: "8" }}
      >
        <Heading
          as="h1"
          fontFamily="display"
          fontWeight="normal"
          fontSize={{ base: "3xl", md: "4xl" }}
          lineHeight="1.05"
          letterSpacing="tight"
        >
          Skills
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          What each skill covers, and the ability behind it.
        </Text>
      </Stack>

      <SkillTable
        rows={rows}
        params={params}
        open={openEntityAside.bind(null, "skill")}
      />
    </Box>
  );
}
