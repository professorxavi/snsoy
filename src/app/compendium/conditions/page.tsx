import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { conditionEffect } from "@/lib/content/conditions";
import { listGeneric, type GenericListRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Conditions",
  description:
    "The fifteen conditions, and what each one does to the creature under it.",
};

const COLUMNS: GenericColumn<GenericListRow>[] = [
  { label: "Effect", cell: (row) => conditionEffect(row.slug) },
];

/**
 * The condition browse view.
 *
 * A condition is met mid-combat and read in seconds, so the list gives the
 * effect on the row and the whole text in the aside. Nothing to filter or page:
 * fifteen rows from one book fit on one screen, and no URL state at all —
 * conditions have no second facet to sort by.
 */
export default async function ConditionsPage() {
  const rows = await listGeneric("condition", {});

  return (
    /*
     * Held to a column rather than the page's full width — see the skills page,
     * which sets the same measure for the same reason. The space the table does
     * not use is where the aside opens.
     */
    <Box
      as="main"
      id="main"
      maxW="4xl"
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
          Conditions
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          What being blinded, grappled or frightened actually does to you.
        </Text>
      </Stack>

      <GenericTable
        rows={rows}
        type="condition"
        columns={COLUMNS}
        noun="conditions"
        open={openEntityAside.bind(null, "condition")}
      />
    </Box>
  );
}
