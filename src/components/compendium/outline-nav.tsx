import { Box, Stack, Text } from "@chakra-ui/react";

/**
 * The section list that sits on the trailing edge of a reading page.
 *
 * Long entries lose you. A PHB Tiefling page carries its own traits plus
 * thirteen subraces; a class page will be far worse. The outline is the cheap
 * fix — it says what is on the page and lets you jump, without putting anything
 * between the reader and the text.
 *
 * Plain in-page anchors, so it works with no JavaScript, is linkable, and lands
 * in browser history. Scroll-spy highlighting is deliberately not here: it
 * would need a client component and an observer to solve a problem this page
 * does not have yet.
 */

export interface OutlineItem {
  id: string;
  label: string;
  /** Nested a level in — subraces under a "Subraces" grouping, for example. */
  depth?: 0 | 1;
}

export function OutlineNav({
  items,
  label = "On this page",
}: {
  items: OutlineItem[];
  label?: string;
}) {
  if (items.length === 0) return null;

  return (
    <Stack gap="2">
      <Text
        fontFamily="ui"
        fontSize="2xs"
        fontWeight="semibold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="fg.subtle"
      >
        {label}
      </Text>

      <Stack as="ul" gap="0" css={{ listStyle: "none" }}>
        {items.map((item) => (
          <Box as="li" key={item.id}>
            <Box
              asChild
              display="block"
              py="1"
              pl={item.depth ? "3" : "0"}
              fontFamily="ui"
              fontSize="xs"
              lineHeight="1.35"
              color={item.depth ? "fg.subtle" : "fg.muted"}
              borderLeftWidth={item.depth ? "1px" : "0"}
              borderColor="border"
              _hover={{ color: "brand" }}
            >
              <a href={`#${item.id}`}>{item.label}</a>
            </Box>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
