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
  title: "Rewards",
  description:
    "Blessings, charms, boons and piety traits — what a party is given rather than finds.",
};

const FIELDS = { kind: "type" } as const;

type Row = GenericRow<typeof FIELDS>;

const COLUMNS: GenericColumn<Row>[] = [
  { label: "Kind", cell: (row) => row.kind ?? "—", nowrap: true },
  {
    label: "Source",
    cell: (row) => row.sourceId,
    nowrap: true,
    optional: true,
  },
];

const BASE = listHrefFor("reward");

/**
 * The rewards browse view.
 *
 * 235 rows in nine kinds, and the kind is what a reader is choosing between: a
 * charm is spent, a blessing is permanent, and a piety trait is earned by
 * degrees. Only eight carry a rarity, so it is not worth a column.
 */
export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("reward", FIELDS, q);

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
          Rewards
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          What a patron, a god or a deed grants a character. Open one to read
          it in full without leaving the list.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["reward", "rewards"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="reward"
        columns={COLUMNS}
        noun="rewards"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "reward")}
      />
    </Box>
  );
}
