import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { senseCovers } from "@/lib/content/senses";
import { listGeneric, type GenericListRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Senses",
  description:
    "Blindsight, darkvision, tremorsense and truesight, and what each one lets a creature perceive.",
};

/**
 * What each sense covers. Sourced from a hand-written map rather than the blob,
 * for the reason `senseCovers` gives — the book's own opening sentence is about
 * the creatures that have the sense, not the sense.
 *
 * A sense maps no JSON fields at all, so its row is the registry columns alone.
 */
const COLUMNS: GenericColumn<GenericListRow>[] = [
  { label: "Perceives", cell: (row) => senseCovers(row.slug) },
];

/**
 * The senses browse view.
 *
 * Four rows, and the smallest list in the compendium — but the most cited
 * unbuilt type in the books at 794 inbound tags, every one of which was plain
 * text until this route existed. A reader meets "blindsight 60 ft." in a stat
 * block and wants one sentence, which is exactly what the aside gives without
 * taking them off the stat block.
 *
 * Nothing to filter, page or sort: four rows from two books fit several times
 * over on one screen, and no source column, since naming the book a sense was
 * printed in answers no question a reader brought here.
 */
export default async function SensesPage() {
  const rows = await listGeneric("sense", {});

  return (
    /*
     * Held to a column rather than the page's full width — see the skills page,
     * which sets the same measure for the same reason. The space the table does
     * not use is where the aside opens.
     */
    <Box as="main" id="main" maxW="4xl" px={{ base: "5", md: "8" }} pb="16">
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
          Senses
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          How a creature perceives what it cannot simply see. Open one to read
          it in full without leaving the list.
        </Text>
      </Stack>

      <GenericTable
        rows={rows}
        type="sense"
        columns={COLUMNS}
        noun="senses"
        open={openEntityAside.bind(null, "sense")}
      />
    </Box>
  );
}
