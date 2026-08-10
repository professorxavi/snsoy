import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { clearAll, hasFilters, type QueryParams } from "@/lib/query-params";
import type { FacetOption } from "@/server/db/queries/facets";

/**
 * The parts every filter rail is built from.
 *
 * Extracted when the monsters list became the second rail. What differs between
 * views is which facets exist and what their values are called; how an option
 * behaves — always shown, disabled rather than removed, a link rather than a
 * control — must not differ, because a rail that behaves differently per view
 * teaches the reader nothing they can carry.
 *
 * Options are links, not client-side controls: filter state lives in the URL,
 * so a link *is* the state change. Nothing here needs hydration.
 */

export function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Box as="section">
      <Text
        as="h2"
        fontFamily="ui"
        fontSize="2xs"
        fontWeight="semibold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="fg.subtle"
        mb="1.5"
      >
        {label}
      </Text>
      <Stack gap="0">{children}</Stack>
    </Box>
  );
}

/**
 * One filter option. Selected state is carried by fill and weight as well as
 * colour, since colour alone is not a sufficient signal (WCAG 1.4.1).
 */
export function FilterOption<T extends string | number>({
  facet,
  href,
  children,
}: {
  facet: FacetOption<T>;
  href: string;
  children: ReactNode;
}) {
  const { selected, disabled, count } = facet;

  const body = (
    <>
      <Box as="span">{children}</Box>
      <Box
        as="span"
        fontSize="2xs"
        color="fg.subtle"
        fontVariantNumeric="tabular-nums"
      >
        {count}
      </Box>
    </>
  );

  return (
    <Box
      asChild
      display="flex"
      justifyContent="space-between"
      alignItems="baseline"
      gap="2"
      px="2"
      py="1"
      rounded="l1"
      fontFamily="ui"
      fontSize="xs"
      fontWeight={selected ? "semibold" : "normal"}
      color={selected ? "brand" : disabled ? "fg.subtle" : "fg.muted"}
      bg={selected ? "brand.subtle" : "transparent"}
      opacity={disabled ? 0.38 : 1}
      cursor={disabled ? "not-allowed" : undefined}
      transition="background .1s, color .1s"
      _hover={
        disabled ? {} : { bg: selected ? "brand.subtle" : "bg.muted", color: "fg" }
      }
    >
      {disabled ? (
        // A span, not a dead anchor, so it is neither focusable nor announced
        // as a destination.
        <span aria-disabled="true">{body}</span>
      ) : (
        <NextLink href={href} aria-current={selected ? "true" : undefined}>
          {body}
        </NextLink>
      )}
    </Box>
  );
}

/**
 * The "clear filters" line at the top of a rail.
 *
 * Holds its height when there is nothing to clear, so applying the first filter
 * does not shift every group below it down the page.
 */
export function ClearFilters({
  params,
  filterKeys,
  basePath,
}: {
  params: QueryParams;
  filterKeys: string[];
  basePath: string;
}) {
  return (
    <Box minH="4">
      {hasFilters(params, filterKeys) ? (
        <Box
          asChild
          fontFamily="ui"
          fontSize="2xs"
          fontWeight="medium"
          letterSpacing="wide"
          textTransform="uppercase"
          color="brand"
          _hover={{ textDecoration: "underline" }}
        >
          {/* Sort survives, because it is not a filter and clearing one is not
              a request to reorder the list. */}
          <NextLink href={`${basePath}${clearAll(params, ["sort"])}`}>
            Clear filters
          </NextLink>
        </Box>
      ) : null}
    </Box>
  );
}

/** The rail once the aside takes the width: an icon strip, with its state. */
export function CollapsedFilterRail({
  params,
  filterKeys,
}: {
  params: QueryParams;
  filterKeys: string[];
}) {
  const active = hasFilters(params, filterKeys);

  return (
    <Box py="4" display="flex" flexDirection="column" alignItems="center" gap="3">
      <Text fontSize="md" color={active ? "brand" : "fg.subtle"} aria-hidden="true">
        &#9698;
      </Text>
      <Text
        fontSize="2xs"
        letterSpacing="widest"
        textTransform="uppercase"
        color={active ? "brand" : "fg.subtle"}
        fontWeight="semibold"
        css={{ writingMode: "vertical-rl" }}
      >
        Filters
      </Text>
    </Box>
  );
}

/** The rail's outer stack, so every view spaces its groups the same way. */
export function FilterRailBody({ children }: { children: ReactNode }) {
  return (
    <Stack gap="5" px="3" py="4" pb="12">
      {children}
    </Stack>
  );
}
