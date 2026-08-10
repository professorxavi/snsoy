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
import { listGeneric, type GenericListRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Diseases",
  description:
    "Sight rot, cackle fever, the Shivering Sickness and every other affliction the books name.",
};

/**
 * A disease's blob carries a name and its text and nothing else — no save, no
 * onset, no duration as data; all of that is written into the prose. So the
 * only column is the book, and the panel is where a disease is read.
 */
const COLUMNS: GenericColumn<GenericListRow>[] = [
  { label: "Source", cell: (row) => row.sourceId, nowrap: true },
];

const BASE = listHrefFor("disease");

export default async function DiseasesPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("disease", {}, q);

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
          Diseases
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          Afflictions a party can catch, and what each one costs them. Open one
          to read it in full without leaving the list.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["disease", "diseases"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="disease"
        columns={COLUMNS}
        noun="diseases"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "disease")}
      />
    </Box>
  );
}
