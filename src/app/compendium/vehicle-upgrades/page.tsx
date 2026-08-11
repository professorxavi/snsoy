import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import { upgradeKind } from "@/lib/content/vehicles";
import { readString, type QueryParams } from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { listGeneric, type GenericRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Vehicle Upgrades",
  description:
    "Hulls, sails, figureheads and the fiendish gadgets bolted onto war machines.",
};

const FIELDS = { kind: "upgradeType" } as const;

type Row = GenericRow<typeof FIELDS>;

/**
 * The category is the whole of the list's structure: 31 upgrades in two
 * families that never mix, and "Screaming Sails" alone does not say whether it
 * goes on a ship or a war machine.
 */
const COLUMNS: GenericColumn<Row>[] = [
  { label: "Category", cell: (row) => upgradeKind(row.kind), nowrap: true },
  { label: "Source", cell: (row) => row.sourceId, nowrap: true },
];

const BASE = listHrefFor("vehicleUpgrade");

/**
 * The vehicle upgrades browse view.
 *
 * 31 rows and no rail: eight categories over 31 entities costs more attention
 * than the scan it saves, and the category is already a column.
 */
export default async function VehicleUpgradesPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("vehicleUpgrade", FIELDS, q);

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
          Vehicle Upgrades
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          What a crew bolts on: hulls and sails for a ship, armour and gadgets
          for an infernal war machine. Open one to read it in full without
          leaving the list.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["upgrade", "upgrades"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="vehicleUpgrade"
        columns={COLUMNS}
        noun="upgrades"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "vehicleUpgrade")}
      />
    </Box>
  );
}
