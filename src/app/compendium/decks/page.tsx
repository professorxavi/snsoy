import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { ListToolbar } from "@/components/compendium/list-controls";
import { deckSize } from "@/lib/content/cards";
import { readString, type QueryParams } from "@/lib/query-params";
import { listHrefFor } from "@/lib/routes";
import { listGeneric, type GenericRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Decks",
  description:
    "Decks of many things, tarokka, illusions and the rest, with the cards each one deals.",
};

const FIELDS = { cards: "cards" } as const;

type Row = GenericRow<typeof FIELDS>;

/**
 * How many cards, and where they come from. There is nothing else about a deck
 * worth a column — what a deck *is* is the list in its panel.
 */
const COLUMNS: GenericColumn<Row>[] = [
  { label: "Cards", cell: (row) => deckSize(row.cards) || "—", nowrap: true },
  { label: "Source", cell: (row) => row.sourceId, nowrap: true },
];

const BASE = listHrefFor("deck");

/**
 * The decks browse view.
 *
 * 31 rows, and the only way into the 656 cards: a card is met through its deck,
 * so the panel this list opens is where the cards are. There was a second list
 * at `/compendium/cards` and it is gone — see `WITHOUT_A_BROWSE_VIEW`.
 */
export default async function DecksPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const q = readString(params, "q");
  const rows = await listGeneric("deck", FIELDS, q);

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
          Decks
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
        >
          Every deck the books print, and what it deals.
        </Text>
      </Stack>

      <ListToolbar
        params={params}
        matched={rows.length}
        filtered={Boolean(q)}
        basePath={BASE}
        noun={["deck", "decks"]}
        carriedKeys={[]}
      />

      <GenericTable
        rows={rows}
        type="deck"
        columns={COLUMNS}
        noun="decks"
        filtered={Boolean(q)}
        open={openEntityAside.bind(null, "deck")}
      />
    </Box>
  );
}
