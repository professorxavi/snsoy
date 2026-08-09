import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import { ConditionTable } from "@/components/compendium/condition-table";
import { listConditions } from "@/server/db/queries/conditions";

export const metadata: Metadata = {
  title: "Conditions",
  description:
    "The fifteen conditions, and what each one does to the creature under it.",
};

/**
 * The condition browse view.
 *
 * A condition is met mid-combat and read in seconds, so the list gives the
 * effect on the row and the whole text in the aside. Nothing to filter or page:
 * fifteen rows from one book fit on one screen, and no URL state at all —
 * conditions have no second facet to sort by.
 */
export default async function ConditionsPage() {
  const rows = await listConditions();

  return (
    <Box as="main" id="main" pb="16">
      <Stack
        gap="3"
        maxW="measure"
        px={{ base: "5", md: "8" }}
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
          Conditions
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          What being blinded, grappled or frightened actually does to you. Open
          one to read it in full without leaving the list.
        </Text>
      </Stack>

      <ConditionTable rows={rows} open={openEntityAside.bind(null, "condition")} />
    </Box>
  );
}
