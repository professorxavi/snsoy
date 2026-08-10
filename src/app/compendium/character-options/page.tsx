import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import { characterOptionSummary } from "@/lib/content/character-options";
import { readString, type QueryParams } from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { listGeneric, type GenericRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Character Options",
  description:
    "Supernatural gifts, dark gifts, character secrets and runes — the extras a setting hands out at character creation.",
};

const FIELDS = { optionType: "optionType" } as const;

type CharacterOptionRow = GenericRow<typeof FIELDS>;

const COLUMNS: GenericColumn<CharacterOptionRow>[] = [
  { label: "Kind", cell: (row) => characterOptionSummary(row.optionType) },
  /*
   * The book, unusually: these belong to one setting each — a dark gift is
   * Ravenloft's and means nothing at another table — so the source is part of
   * what the option *is* rather than a bibliographic note.
   */
  { label: "Source", cell: (row) => row.sourceId, nowrap: true, optional: true },
];

const BASE = listHrefFor("charoption");

/**
 * The character options browse view.
 *
 * 44 rows in four kinds, and the only type in this batch still stored in
 * `generic_entities` — so it needs no query module of its own, just the field
 * map. No rail either: four facet values over 44 rows is a control that costs
 * more attention than the scan it saves.
 */
export default async function CharacterOptionsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("charoption", FIELDS, q);

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
          Character Options
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          What a setting offers a character beyond race, class and background.
          Open one to read it in full without leaving the list.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["character option", "character options"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="charoption"
        columns={COLUMNS}
        noun="character options"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "charoption")}
      />
    </Box>
  );
}
