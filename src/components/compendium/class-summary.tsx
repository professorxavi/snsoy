import { Box, Text } from "@chakra-ui/react";
import { casterLabel, formatAbilities } from "@/lib/content/classes";
import type { ClassDetail } from "@/server/db/queries/classes";

/**
 * Hit die, saving throws, casting and what the class calls its subclasses.
 *
 * Shared by the class page and the aside so the two cannot drift: the aside is
 * a shorter view of the same class, not a different account of it.
 */
export function ClassSummary({ found }: { found: ClassDetail }) {
  const parts = [
    { label: "Hit Die", value: found.hitDie ? `d${found.hitDie}` : null },
    { label: "Saves", value: formatAbilities(found.savingThrows) },
    {
      label: "Casting",
      value: found.spellcastingAbility
        ? `${casterLabel(found.casterProgression) ?? "Caster"}, ${formatAbilities([found.spellcastingAbility])}`
        : casterLabel(found.casterProgression),
    },
    {
      label: "Subclasses",
      // Named the way the class names them: a Cleric has domains, not subclasses.
      value:
        found.subclasses.length > 0
          ? `${found.subclasses.length} ${found.subclassTitle ? `${found.subclassTitle}s` : "subclasses"}`
          : null,
    },
  ].filter((part) => part.value);

  if (parts.length === 0) return null;

  return (
    <Box
      display="flex"
      flexWrap="wrap"
      columnGap="5"
      rowGap="1"
      mt="3"
      pt="3"
      borderTopWidth="1px"
      borderColor="border"
    >
      {parts.map((part) => (
        <Box key={part.label}>
          <Text
            as="span"
            fontFamily="ui"
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="wide"
            textTransform="uppercase"
            color="fg.subtle"
            mr="1.5"
          >
            {part.label}
          </Text>
          <Text as="span" fontFamily="body" fontSize="sm">
            {part.value}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
