"use client";

import { Box, Text } from "@chakra-ui/react";

/**
 * The bar above a list.
 *
 * The search field is controlled and filters on the keystroke. There is no
 * form, no submit and no request: the whole spell list is already in memory, so
 * the only honest interaction is one that updates the table as you type.
 *
 * `type="search"` rather than `text`, so the browser supplies its own clear
 * button and the field is announced as a search.
 */
export function ListToolbar({
  query,
  onQueryChange,
  matched,
  filtered,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  matched: number;
  /** Whether anything is filtered. Governs whether a count is shown at all. */
  filtered: boolean;
}) {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap="4"
      px="4"
      py="2.5"
      borderBottomWidth="1px"
      borderColor="border"
      bg="bg.panel"
      position="sticky"
      top="var(--chakra-sizes-topbar)"
      zIndex="1"
    >
      <Box
        asChild
        w={{ base: "40", sm: "64" }}
        px="2.5"
        py="1"
        fontFamily="ui"
        fontSize="xs"
        bg="bg"
        borderWidth="1px"
        borderColor="border"
        rounded="l1"
        _focusVisible={{ borderColor: "brand" }}
      >
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search spells"
          aria-label="Search spells by name"
        />
      </Box>

      {/*
        A count only once the reader has narrowed something. "525 spells" is a
        fact about our database; "18 spells" after filtering is the answer to
        the question they just asked.
      */}
      {filtered ? (
        <Text
          fontFamily="ui"
          fontSize="2xs"
          color="fg.subtle"
          fontVariantNumeric="tabular-nums"
          whiteSpace="nowrap"
          aria-live="polite"
        >
          {matched} {matched === 1 ? "spell" : "spells"}
        </Text>
      ) : null}
    </Box>
  );
}
