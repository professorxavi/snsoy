import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import {
  vehicleCargo,
  vehicleKind,
  vehicleSize,
  vehicleTerrain,
} from "@/lib/content/vehicles";
import { readString, type QueryParams } from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { listGeneric, type GenericRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Vehicles",
  description:
    "Ships, spelljammers and infernal war machines, with what each one carries.",
};

const FIELDS = {
  kind: "vehicleType",
  size: "size",
  terrain: "terrain",
  cargo: "capCargo",
} as const;

type Row = GenericRow<typeof FIELDS>;

/**
 * What separates one vehicle from the next: what kind of thing it is, where it
 * goes and what it can carry. Size is the fourth because 16 of the 35 have
 * none — a spelljammer is stated by its dimensions instead — and a column that
 * is empty for half the list belongs where it can be shed.
 */
const COLUMNS: GenericColumn<Row>[] = [
  { label: "Kind", cell: (row) => titleCased(vehicleKind(row.kind)), nowrap: true },
  { label: "Terrain", cell: (row) => vehicleTerrain(row.terrain) || "—", nowrap: true },
  {
    label: "Cargo",
    cell: (row) => vehicleCargo(row.cargo, row.kind) || "—",
    nowrap: true,
    optional: true,
  },
  {
    label: "Size",
    cell: (row) => vehicleSize(row.size) || "—",
    nowrap: true,
    optional: true,
  },
];

/** The kind reads as a noun mid-sentence and as a heading in a cell. */
function titleCased(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

const BASE = listHrefFor("vehicle");

/**
 * The vehicles browse view.
 *
 * 35 rows, and the only type in the compendium whose panel is a stat block
 * written from scratch: 33 of them carry no prose at all, and are nothing but
 * their numbers and the components a crew can lose.
 */
export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("vehicle", FIELDS, q);

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
          Vehicles
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          Everything a party can crew, from a rowboat to a nautiloid. Open one to
          read its stat block without leaving the list.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["vehicle", "vehicles"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="vehicle"
        columns={COLUMNS}
        noun="vehicles"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "vehicle")}
      />
    </Box>
  );
}
