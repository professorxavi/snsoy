import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import { trapKindLabel, trapThreat } from "@/lib/content/traps";
import { readString, type QueryParams } from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { listGeneric, type GenericRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Traps",
  description:
    "Simple, mechanical, complex and magic traps, with the threat each was rated for.",
};

const FIELDS = { kind: "trapHazType", rating: "rating" } as const;

type TrapRow = GenericRow<typeof FIELDS>;

const COLUMNS: GenericColumn<TrapRow>[] = [
  { label: "Kind", cell: (row) => trapKindLabel(row.kind), nowrap: true },
  { label: "Threat", cell: (row) => trapThreat(row.rating) },
];

const BASE = listHrefFor("trap");

/**
 * The traps browse view.
 *
 * 29 rows and two columns, which is the whole of what distinguishes one trap
 * from another before you read it: what kind of thing it is, and how much of a
 * threat it was written to be. Everything else is the trap's own text.
 */
export default async function TrapsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("trap", FIELDS, q);

  return (
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
          Traps
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          What a dungeon does to a party that stops looking. Open one to read it
          in full without leaving the list.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["trap", "traps"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="trap"
        columns={COLUMNS}
        noun="traps"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "trap")}
      />
    </Box>
  );
}
