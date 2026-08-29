import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import { languageKind, languageScript } from "@/lib/content/languages";
import { readString, type QueryParams } from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { listLanguages, type LanguageGroup } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Languages",
  description:
    "Every language in the books, what kind it is, and the script it is written in.",
};

type LanguageRow = LanguageGroup;

const COLUMNS: GenericColumn<LanguageRow>[] = [
  { label: "Sources", cell: (row) => row.sourceIds.join(", ") },
  { label: "Kind", cell: (row) => row.kindVaries ? "Varies" : languageKind(row.kind), nowrap: true },
  {
    label: "Script",
    cell: (row) => row.scriptVaries ? "Varies" : languageScript(row.script),
    nowrap: true,
    // The first thing a 400px panel can afford to lose: a reader with one
    // language open is reading it, not comparing alphabets.
    optional: true,
  },
];

const BASE = listHrefFor("language");

/**
 * The languages browse view.
 *
 * The first of these rules lists long enough to need finding rather than
 * scanning — 135 rows against four senses — so it carries the search field the
 * shorter ones do without. Still no facets: kind and script are the only two
 * axes, and a rail over 135 rows would cost more attention than it saved.
 */
export default async function LanguagesPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listLanguages(q);

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
          Languages
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
          textWrap="pretty"
        >
          What your character can speak, read and overhear.
        </Text>
      </Stack>

      {/* No filters to carry: the search field is the only state this list has. */}
      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["language", "languages"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="language"
        columns={COLUMNS}
        noun="languages"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "language")}
      />
    </Box>
  );
}
