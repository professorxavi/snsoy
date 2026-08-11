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
  title: "Cults",
  description:
    "The cults of the demon lords and archdevils, with their goals and typical cultists.",
};

const FIELDS = { kind: "type" } as const;

type Row = GenericRow<typeof FIELDS>;

const COLUMNS: GenericColumn<Row>[] = [
  { label: "Kind", cell: (row) => row.kind ?? "—", nowrap: true },
  { label: "Source", cell: (row) => row.sourceId, nowrap: true },
];

const BASE = listHrefFor("cult");

/**
 * The cults browse view.
 *
 * 29 rows. Most of what a cult knows sits beside its prose — its goal, its
 * typical cultists, its signature spells — which the panel prints as its own
 * lines; see `LabelledLines`.
 */
export default async function CultsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("cult", FIELDS, q);

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
          Cults
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          Who worships the things that should not be worshipped, and why. Open
          one to read it in full without leaving the list.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["cult", "cults"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="cult"
        columns={COLUMNS}
        noun="cults"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "cult")}
      />
    </Box>
  );
}
