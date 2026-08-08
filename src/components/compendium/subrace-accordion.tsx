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
 * Ark UI state machines and does not respond to clicks in this app at all —
 * verified down to a minimal isolated instance on a scratch route, where the
 * trigger has an `onClick` in its React props, hydration succeeds, no console
 * error appears, and `onValueChange` still never fires. That is worth chasing
 * separately, since Dialog, Tabs, Menu and Popover share the machinery; it is
 * not worth blocking a collapsible list on.
 *
 * `<details>` is also the better fit here regardless: it is a server component,
 * needs no JavaScript to open, is keyboard accessible for free, and browsers
 * already expand it when a deep link points inside — which matters because ~93
 * inbound `{@race dwarf (hill)}` links resolve to an anchor in here.
 *
 * The anchor sits **inside** the disclosure rather than on it. That is the
 * difference between a deep link working and not: browsers expand a closed
 * `<details>` when the fragment targets its *contents*, and do nothing when it
 * targets the element itself.
 */

export interface SubraceItem {
  /** The subrace's slug — the anchor inbound links resolve to. */
  id: string;
  name: string;
  meta?: ReactNode;
  body: ReactNode;
}

export function SubraceAccordion({ items }: { items: SubraceItem[] }) {
  if (items.length === 0) return null;

  return (
    <Stack gap="0">
      {items.map((item) => (
        <Box
          as="details"
          key={item.id}
          borderTopWidth="1px"
          borderColor="border"
          css={{
            // The disclosure triangle, rotated by the open state rather than
            // by script.
            "&[open] [data-chevron]": { transform: "rotate(90deg)" },
          }}
        >
          <Box
            as="summary"
            display="flex"
            alignItems="baseline"
            gap="3"
            py="3"
            cursor="pointer"
            css={{
              // Suppress the default marker in every engine so the custom one
              // is not shown twice.
              listStyle: "none",
              "&::marker": { content: '""' },
              "&::-webkit-details-marker": { display: "none" },
            }}
            _hover={{ color: "brand" }}
          >
            <Box
              data-chevron=""
              aria-hidden="true"
              fontSize="2xs"
              color="fg.subtle"
              transition="transform .15s ease"
              lineHeight="1.6"
            >
              &#9654;
            </Box>

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
