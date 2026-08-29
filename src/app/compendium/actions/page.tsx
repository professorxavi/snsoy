import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { Metadata } from "next";
import { openEntityAside } from "@/app/aside-actions";
import {
  GenericTable,
  type GenericColumn,
} from "@/components/compendium/generic-table";
import { actionDoes, actionTime } from "@/lib/content/actions";
import { listGeneric, type GenericRow } from "@/server/db/queries/generic";

export const metadata: Metadata = {
  title: "Actions",
  description:
    "What you can do on your turn, and whether it costs an action, a bonus action or a reaction.",
};

/** `time` is an array, so the projection hands back its JSON — see `actionTime`. */
const FIELDS = { time: "time" } as const;

type ActionRow = GenericRow<typeof FIELDS>;

const COLUMNS: GenericColumn<ActionRow>[] = [
  // Before the summary, because it is the question asked at the table: a player
  // who already knows what Dodge does is looking for what it costs.
  { label: "Time", cell: (row) => actionTime(row.time), nowrap: true },
  { label: "Does", cell: (row) => actionDoes(row.slug) },
];

/**
 * The actions browse view.
 *
 * Thirty rows and 743 inbound tags — the second largest block of dead links in
 * book text after senses, because every rule that says you can {@action shove}
 * a creature was pointing at nothing.
 *
 * Nothing to filter or page. No source column either: three books define these
 * between them, but which one printed Overrun is not a question anyone brings
 * to a list of actions.
 */
export default async function ActionsPage() {
  const rows = await listGeneric("action", FIELDS);

  return (
    /*
     * Held to a column rather than the page's full width — see the skills page,
     * which sets the same measure for the same reason, and centred in whatever
     * width it is given. The aside takes a grid column of its own rather than
     * the space beside the table, so centring costs it nothing.
     */
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
          Actions
        </Heading>
        <Text
          className="prose"
          fontFamily="body"
          fontSize="md"
          lineHeight="1.65"
          color="fg.muted"
          textWrap="pretty"
        >
          What you can do on your turn, and what it costs.
        </Text>
      </Stack>

      <GenericTable
        rows={rows}
        type="action"
        columns={COLUMNS}
        noun="actions"
        open={openEntityAside.bind(null, "action")}
      />
    </Box>
  );
}
