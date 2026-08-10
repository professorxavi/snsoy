import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import { trapKindLabel } from "@/lib/content/traps";
import { readString, type QueryParams } from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { listGeneric, type GenericRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Hazards",
  description:
    "Weather, wilderness, eldritch storms and the moulds and slimes a dungeon grows.",
};

const FIELDS = { kind: "trapHazType" } as const;

type HazardRow = GenericRow<typeof FIELDS>;

const COLUMNS: GenericColumn<HazardRow>[] = [
  { label: "Kind", cell: (row) => trapKindLabel(row.kind), nowrap: true },
  /*
   * The book, because a hazard is often the setting's own: Thrym's Howl is a
   * Tasha's storm and Razorvine is a plane's plant, and which book it came from
   * is part of knowing whether it belongs at your table.
   */
  { label: "Source", cell: (row) => row.sourceId, nowrap: true },
];

const BASE = listHrefFor("hazard");

/**
 * The hazards browse view.
 *
 * 28 rows, seven of which carry no kind — the moulds, the slimes, Webs and Rot
 * Grub, printed together in the books without a category. Their cell is an em
 * dash rather than a name nobody wrote.
 */
export default async function HazardsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("hazard", FIELDS, q);

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
          Hazards
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          What the world does to a party without anyone deciding to. Open one to
          read it in full without leaving the list.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["hazard", "hazards"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="hazard"
        columns={COLUMNS}
        noun="hazards"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "hazard")}
      />
    </Box>
  );
}
