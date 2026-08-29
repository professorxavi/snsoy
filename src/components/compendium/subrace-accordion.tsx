import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

/**
 * Collapsible subrace list. A PHB Tiefling has twelve subraces, which would
 * otherwise push the race's own traits off screen.
 *
 * Built on `<details>` rather than Chakra's Accordion, which does not respond
 * to clicks anywhere in this app (verified down to a minimal isolated case).
 * `<details>` also needs no JavaScript to open and is keyboard accessible.
 *
 * The anchor sits inside the disclosure, not on it: browsers expand a closed
 * `<details>` when the fragment targets its contents, but not the element.
 *
 * Opening the one a deep link points into is `FragmentTarget`'s job, in
 * `ReadingColumn` — this list used to carry its own copy, which only ever
 * covered subraces and left the identical problem on classes and chapters
 * unaddressed.
 */

export interface SubraceItem {
  /** The subrace's slug, which inbound links resolve to. */
  id: string;
  /**
   * What React lists this disclosure by. Separate from `id`, since a slug is
   * unique only within a source — pass the subrace's natural key.
   */
  listKey: string;
  name: string;
  meta?: ReactNode;
  body: ReactNode;
}

export function SubraceList({ items }: { items: SubraceItem[] }) {
  if (items.length === 0) return null;

  return (
    <Stack gap="0">
      {items.map((item) => (
        <Box
          as="details"
          key={item.listKey}
          borderBottomWidth="1px"
          borderColor="border"
          css={{ "&[open] [data-chevron]": { transform: "rotate(90deg)" } }}
        >
          <Box
            as="summary"
            display="flex"
            alignItems="center"
            gap="2.5"
            py="2.5"
            cursor="pointer"
            css={{
              // Suppress the default marker, or it shows alongside the custom one.
              listStyle: "none",
              "&::marker": { content: '""' },
              "&::-webkit-details-marker": { display: "none" },
            }}
            _hover={{ color: "brand" }}
          >
            <Chevron />

            <Text
              as="span"
              flex="1"
              fontFamily="body"
              fontWeight="semibold"
              fontSize="md"
              lineHeight="1.3"
            >
              {item.name}
            </Text>

            {item.meta ? (
              <Text
                as="span"
                fontFamily="ui"
                fontSize="2xs"
                letterSpacing="wide"
                color="fg.subtle"
                /*
                 * Wraps. A book's name is not an atomic value: "Dragonlance:
                 * Shadow of the Dragon Queen · p. 34" held on one line was the
                 * only thing scrolling the Sorcerer page sideways at 320px.
                 */
              >
                {item.meta}
              </Text>
            ) : null}
          </Box>

          {/* Anchor goes here, not on the <details>. See the note above. */}
          <Box id={item.id} scrollMarginTop="4rem" pl="6" pb="5">
            {item.body}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

/**
 * The disclosure arrow, as SVG rather than a character. U+25B6 renders as an
 * emoji glyph on most platforms and ignores `color`.
 */
function Chevron() {
  return (
    <Box
      asChild
      data-chevron=""
      w="2.5"
      h="2.5"
      flexShrink="0"
      color="fg.subtle"
      transition="transform .15s ease"
    >
      <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path
          d="M3.5 1.5 L7 5 L3.5 8.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
}
