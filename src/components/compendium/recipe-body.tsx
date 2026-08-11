import { Box, Stack, Text } from "@chakra-ui/react";
import { Entries, type Entry } from "@/components/entry";
import { ingredientText } from "@/lib/content/recipes";
import type { ReferenceIndex } from "@/lib/content/references";

/**
 * A recipe: what goes in it, and what to do with it.
 *
 * The only type in the compendium with no `entries` at all — a recipe is
 * `ingredients` and `instructions`, two entry arrays side by side — so without
 * this the panel would open every one of the 241 showing a name and nothing
 * else.
 *
 * The ingredients are not handed to the renderer as stored. Each line carries
 * its quantities as placeholders (`"{=amount1/v} pound thick-cut bacon"` with
 * `amount1: 0.5`), and the values live on the ingredient object beside the
 * text — so they are substituted here, where both halves are in hand, exactly
 * as an item's `{=baseName}` is.
 */
export function RecipeBody({
  data,
  refs,
  selfKey,
  context,
}: {
  data: Record<string, unknown>;
  refs: ReferenceIndex;
  selfKey?: string;
  context?: string;
}) {
  const ingredients = asRecords(data["ingredients"]).map(ingredientText);
  const instructions = data["instructions"];

  return (
    <Stack gap="4">
      {ingredients.length > 0 ? (
        <Box>
          <Heading>Ingredients</Heading>
          <Entries
            entries={[{ type: "list", items: ingredients }] as Entry[]}
            refs={refs}
            selfKey={selfKey}
            context={context}
          />
        </Box>
      ) : null}

      {Array.isArray(instructions) && instructions.length > 0 ? (
        <Box>
          <Heading>Instructions</Heading>
          <Entries
            entries={instructions as Entry[]}
            refs={refs}
            selfKey={selfKey}
            context={context}
          />
        </Box>
      ) : null}
    </Stack>
  );
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      )
    : [];
}

function Heading({ children }: { children: string }) {
  return (
    <Text
      as="h2"
      fontFamily="display"
      fontSize="md"
      letterSpacing="tight"
      borderBottomWidth="1px"
      borderColor="border.emphasized"
      pb="0.5"
      mb="2"
    >
      {children}
    </Text>
  );
}
