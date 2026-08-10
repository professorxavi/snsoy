import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import { objectSize, objectStat } from "@/lib/content/objects";
import { readString, type QueryParams } from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { listGeneric, type GenericRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Objects",
  description:
    "Siege weapons and the other things with an armour class, from ballistas to eldritch cannons.",
};

const FIELDS = { size: "size", ac: "ac", hp: "hp" } as const;

type ObjectRow = GenericRow<typeof FIELDS>;

/**
 * The three numbers a party wants before they start hitting it. Short forms in
 * the cells: the two entries whose hit points are a sentence read as "Varies"
 * here and print the sentence in the panel.
 */
const COLUMNS: GenericColumn<ObjectRow>[] = [
  { label: "Size", cell: (row) => objectSize(row.size), nowrap: true },
  { label: "AC", cell: (row) => objectStat(row.ac, { short: true }), nowrap: true },
  { label: "HP", cell: (row) => objectStat(row.hp, { short: true }), nowrap: true },
];

const BASE = listHrefFor("object");

/**
 * The objects browse view.
 *
 * 20 rows, and no kind column: half of them are typed `U` in the data, which
 * means nothing a reader could use — the Gulthias Tree and an eldritch cannon
 * share it. Size, AC and hit points are what the type is actually for.
 */
export default async function ObjectsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("object", FIELDS, q);

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
          Objects
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          Siege weapons and the other things a party can attack. Open one to read
          it in full without leaving the list.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["object", "objects"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="object"
        columns={COLUMNS}
        noun="objects"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "object")}
      />
    </Box>
  );
}
