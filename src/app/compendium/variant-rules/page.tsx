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
import { ruleTypeCell } from "@/lib/content/variant-rules";
import { listGeneric, type GenericRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Variant Rules",
  description:
    "Optional and variant rules a table can adopt, and which books they come from.",
};

const FIELDS = { ruleType: "ruleType" } as const;

type VariantRuleRow = GenericRow<typeof FIELDS>;

const COLUMNS: GenericColumn<VariantRuleRow>[] = [
  /*
   * The source is worth more here than on any other rules list: whether a table
   * has adopted a rule usually turns on which book it came out of, and five of
   * the 115 share a slug with a rule from a different one.
   */
  { label: "Source", cell: (row) => row.sourceId, nowrap: true },
  { label: "Kind", cell: (row) => ruleTypeCell(row.ruleType), nowrap: true },
];

const BASE = listHrefFor("variantrule");

/**
 * The variant rules browse view.
 *
 * 115 rows, so it carries the search field languages does. No summary column:
 * these are the longest entries of the batch by a wide margin — a median of
 * 2,390 characters against a skill's 263 — and a rule that runs to two thousand
 * words does not reduce to a line in a table cell without lying about itself.
 * The name and the book are what a reader picks from; the panel is where the
 * rule is read.
 */
export default async function VariantRulesPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("variantrule", FIELDS, q);

  return (
    <Box
      as="main"
      id="main"
      maxW="4xl"
      mx="auto"
      px={{ base: "5", md: "8" }}
      pb="16"
    >
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
          Variant Rules
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          Rules a table can choose to adopt, replace or ignore.
        </Text>
      </Stack>

      {/* No filters to carry: the search field is the only state this list has. */}
      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["variant rule", "variant rules"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="variantrule"
        columns={COLUMNS}
        noun="variant rules"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "variantrule")}
      />
    </Box>
  );
}
