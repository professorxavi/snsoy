import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import { readString, type QueryParams } from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { listGeneric, type GenericRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Boons",
  description:
    "Demonic and diabolical boons: what serving something terrible grants in return.",
};

const FIELDS = { kind: "type" } as const;

type Row = GenericRow<typeof FIELDS>;

const COLUMNS: GenericColumn<Row>[] = [
  { label: "Kind", cell: (row) => row.kind ?? "—", nowrap: true },
  { label: "Source", cell: (row) => row.sourceId, nowrap: true },
];

const BASE = listHrefFor("boon");

/**
 * The boons browse view.
 *
 * The smallest list in the compendium after the senses: 12 rows, each the
 * bargain struck with one demon lord or archdevil.
 */
export default async function BoonsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("boon", FIELDS, q);

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
          Boons
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          What a fiend gives a servant who has earned it. Open one to read it
          in full without leaving the list.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["boon", "boons"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="boon"
        columns={COLUMNS}
        noun="boons"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "boon")}
      />
    </Box>
  );
}
