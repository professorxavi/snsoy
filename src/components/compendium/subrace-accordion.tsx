import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { OpenTargetDetails } from "./open-target-details";

/**
 * Subraces, collapsed.
 *
 * A PHB Tiefling carries thirteen subraces and a PHB Elf nine, each a few
 * paragraphs. Expanded, the race's own traits are pushed so far up the page
 * that the thing you came for is off screen. Collapsed, the page reads the way
 * the book is laid out: here is the race, and here are its variants.
 *
 * **Built on `<details>`, not on Chakra's Accordion.** Chakra's is driven by
 * Ark UI state machines and does not respond to clicks anywhere in this app —
 * verified down to a minimal isolated instance, where the trigger has an
 * `onClick` in its React props, hydration succeeds, no console error appears,
 * and `onValueChange` still never fires. `<details>` is the better fit anyway:
 * a server component, no JavaScript to open, keyboard accessible for free.
 *
 * The anchor sits **inside** the disclosure rather than on it. That is the
 * difference between a deep link working and not: browsers expand a closed
 * `<details>` when the fragment targets its *contents*, and do nothing at all
 * when it targets the element itself.
 */

export interface SubraceItem {
  /** The subrace's slug — the anchor inbound links resolve to. */
  id: string;
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
          key={item.id}
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
              // Suppress the default marker in every engine, or the custom one
              // is shown twice.
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
                whiteSpace="nowrap"
              >
                {item.meta}
              </Text>
            ) : null}
          </Box>

          {/* The anchor, and the reason it is here and not on the <details>. */}
          <Box id={item.id} scrollMarginTop="4rem" pl="6" pb="5">
            {item.body}
          </Box>
        </Box>
      ))}

      <OpenTargetDetails />
    </Stack>
  );
}

/**
 * The disclosure arrow.
 *
 * Drawn, not typed. The obvious character for this — `▶` U+25B6 — is in an
 * emoji-presentation range, so most platforms render it as a blue emoji glyph
 * that ignores `color` entirely and looks pasted on. An inline SVG inherits
 * `currentColor`, scales with the type, and rotates cleanly.
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
