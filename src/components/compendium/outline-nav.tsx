import { Box, Stack, Text } from "@chakra-ui/react";

/**
 * Section list for the trailing edge of a reading page.
 *
 * Plain in-page anchors: no JavaScript, linkable, and they land in history.
 * No scroll-spy highlighting, which would need a client component.
 */

export interface OutlineItem {
  id: string;
  label: string;
  /** Nested a level in, e.g. subraces under a "Subraces" heading. */
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
