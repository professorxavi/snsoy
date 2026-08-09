import { Box, Skeleton, SkeletonText, Stack } from "@chakra-ui/react";
import { ReadingColumn } from "./reading-column";

/**
 * Marks a page that is standing in for another.
 *
 * A route fallback streams: it is real, hydrated markup, and the page it stands
 * for arrives in a hidden block that React swaps in afterwards. So "the page has
 * hydrated" stops meaning "the page is here", and anything measuring the layout
 * has to wait for this to go rather than for React to arrive. Read by
 * `expectHydrated` in the browser tier for exactly that.
 */
export const ROUTE_FALLBACK_ATTR = "data-route-fallback";

/**
 * Stands in for a page while the server builds it.
 *
 * Shaped like the thing it is replacing rather than being a spinner in the
 * middle of an empty screen: the header block, the measure and — where the page
 * has one — the outline gutter are all where they will be, so the reader's eye
 * is already in the right place when the text lands and nothing jumps under it.
 *
 * These are the same skeletons the aside uses for the same reason. What is
 * different here is the geometry: a route fallback replaces a whole page, so it
 * renders through `ReadingColumn` to inherit the real measure and the `<main>`
 * the skip link needs, rather than approximating either.
 */

/**
 * A book chapter, a race, a class, a spell — anything set in the reading
 * column.
 *
 * @param outline Whether the page it stands for has an outline gutter. Passed
 *   rather than assumed: a spell has no named sections and a chapter usually
 *   does, and guessing wrong costs a column of width when the page arrives.
 */
export function ReadingSkeleton({ outline = true }: { outline?: boolean }) {
  return (
    <ReadingColumn outline={outline ? <OutlineSkeleton /> : undefined}>
      <Stack gap="8" aria-hidden="true" {...{ [ROUTE_FALLBACK_ATTR]: "" }}>
        <Stack gap="2.5">
          {/* Source · chapter · page, then the title. */}
          <Skeleton height="2.5" width="16rem" maxW="80%" />
          <Skeleton height="9" width="65%" />
        </Stack>

        <ProseSkeleton lines={5} />
        <Stack gap="3">
          <Skeleton height="5" width="40%" />
          <ProseSkeleton lines={6} />
        </Stack>
        <Stack gap="3">
          <Skeleton height="5" width="34%" />
          <ProseSkeleton lines={4} />
        </Stack>
      </Stack>
    </ReadingColumn>
  );
}

/**
 * A source's contents page: cover, title block, then the chapter list.
 *
 * Renders its own `<main>` because this layout is the page's own, not one of
 * the shared shells.
 */
export function ContentsSkeleton() {
  return (
    <Box
      as="main"
      id="main"
      px={{ base: "5", md: "10" }}
      py={{ base: "8", md: "12" }}
      pb="24"
      aria-hidden="true"
      {...{ [ROUTE_FALLBACK_ATTR]: "" }}
    >
      <Box maxW="4xl" mx="auto">
        <Box
          display="grid"
          gridTemplateColumns={{ base: "1fr", sm: "11rem minmax(0, 1fr)" }}
          gap={{ base: "5", sm: "8" }}
          mb={{ base: "8", md: "10" }}
        >
          <Skeleton
            aspectRatio="5 / 6.5"
            maxW={{ base: "12rem", sm: "none" }}
            rounded="l1"
          />

          <Stack gap="3">
            <Skeleton height="2.5" width="7rem" />
            <Skeleton height="9" width="80%" />
            <ProseSkeleton lines={3} />
          </Stack>
        </Box>

        <Stack gap="0" borderTopWidth="1px" borderColor="border">
          {CHAPTERS.map((width, index) => (
            <Box
              key={index}
              py="3.5"
              borderBottomWidth="1px"
              borderColor="border"
            >
              <Skeleton height="4" width={width} />
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

/**
 * Chapter titles vary in length, and a column of identical bars reads as a
 * loading graphic rather than as a list of chapters. Fixed rather than random
 * so the fallback renders the same on the server and the client.
 */
const CHAPTERS = ["42%", "58%", "35%", "64%", "48%", "52%", "38%", "60%"];

/** A run of body text. `SkeletonText` shortens its last line for us. */
function ProseSkeleton({ lines }: { lines: number }) {
  return <SkeletonText noOfLines={lines} gap="2.5" />;
}

function OutlineSkeleton() {
  return (
    <Stack gap="2.5" aria-hidden="true">
      <Skeleton height="2" width="60%" />
      <Skeleton height="3" width="85%" />
      <Skeleton height="3" width="70%" />
      <Skeleton height="3" width="78%" />
      <Skeleton height="3" width="62%" />
    </Stack>
  );
}
