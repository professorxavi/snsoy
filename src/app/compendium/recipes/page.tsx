import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import { dietLabel, servesSummary } from "@/lib/content/recipes";
import { readString, type QueryParams } from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { listGeneric, type GenericRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Recipes",
  description:
    "Every dish in the Heroes' Feast cookbooks, with its cuisine, diet and what it serves.",
};

const FIELDS = { type: "type", diet: "diet", serves: "serves" } as const;

type Row = GenericRow<typeof FIELDS>;

const COLUMNS: GenericColumn<Row>[] = [
  { label: "Cuisine", cell: (row) => row.type ?? "—" },
  { label: "Diet", cell: (row) => dietLabel(row.diet), nowrap: true },
  {
    label: "Serves",
    cell: (row) => servesSummary(row.serves),
    nowrap: true,
    optional: true,
  },
];

const BASE = listHrefFor("recipe");

/**
 * The recipes browse view.
 *
 * 241 dishes, and the only type whose text is not in `entries` at all — see
 * `RecipeBody`, which is what the panel prints. The diet is the column anyone
 * cooking from this scans first.
 */
export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("recipe", FIELDS, q);

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
          Recipes
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          Food from the worlds the books are set in, written to be cooked.
          Open one to read it in full without leaving the list.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["recipe", "recipes"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="recipe"
        columns={COLUMNS}
        noun="recipes"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "recipe")}
      />
    </Box>
  );
}
