"use client";

import { Box, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

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

/**
 * The pager.
 *
 * Buttons rather than links, because paging changes no data — every row is
 * already loaded and this only decides which slice is on screen. Hidden
 * entirely at one page: a pager that can never do anything is noise.
 */
export function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <Box
      as="nav"
      aria-label="Pagination"
      display="flex"
      alignItems="center"
      justifyContent="center"
      gap="4"
      px="4"
      py="5"
      borderTopWidth="1px"
      borderColor="border"
    >
      <PageButton onClick={() => onPage(page - 1)} disabled={page <= 1}>
        ← Previous
      </PageButton>

      <Text
        fontFamily="ui"
        fontSize="2xs"
        color="fg.subtle"
        fontVariantNumeric="tabular-nums"
        aria-live="polite"
      >
        Page {page} of {pageCount}
      </Text>

      <PageButton onClick={() => onPage(page + 1)} disabled={page >= pageCount}>
        Next →
      </PageButton>
    </Box>
  );
}

function PageButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      asChild
      fontFamily="ui"
      fontSize="xs"
      color="brand"
      px="2"
      py="1"
      rounded="l1"
      _hover={disabled ? {} : { bg: "brand.subtle" }}
      _disabled={{ opacity: 0.4, cursor: "not-allowed", color: "fg.subtle" }}
    >
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    </Box>
  );
}
