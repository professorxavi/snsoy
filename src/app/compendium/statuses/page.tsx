import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { statusMeans } from "@/lib/content/statuses";
import { listGeneric, type GenericListRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Statuses",
  description:
    "Concentration and being surprised — the two markers the rules track apart from conditions.",
};

/** A status maps no JSON fields, so its row is the registry columns alone. */
const COLUMNS: GenericColumn<GenericListRow>[] = [
  { label: "Means", cell: (row) => statusMeans(row.slug) },
];

/**
 * The statuses browse view.
 *
 * Two rows, which is the whole type — but 479 inbound tags point at them, every
 * one of which was plain text until this route existed. Nearly all of those are
 * `{@status concentration}` in a spell's duration line, where what a reader
 * wants is one sentence without losing the spell.
 *
 * Nothing to filter, page or sort, and no source column: both come from the
 * Player's Handbook.
 */
export default async function StatusesPage() {
  const rows = await listGeneric("status", {});

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
          Statuses
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          Two markers the rules track in their own right, rather than as
          conditions. Open one to read it in full without leaving the list.
        </Text>
      </Stack>

      <GenericTable
        rows={rows}
        type="status"
        columns={COLUMNS}
        noun="statuses"
        open={openEntityAside.bind(null, "status")}
      />
    </Box>
  );
}
