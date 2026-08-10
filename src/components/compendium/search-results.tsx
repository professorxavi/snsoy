import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { AsideLink } from "@/components/compendium/aside-link";
import { ASIDE_TYPES, asideKey } from "@/lib/aside";
import { parseSnippet, typeLabel } from "@/lib/content/search";
import { isBrowsable, type BrowsableType } from "@/lib/routes";
import type { SearchResult } from "@/server/db/queries/search";

/**
 * The search results list.
 *
 * A list, not a table. Results are heterogeneous — a spell, a chapter and a
 * class feature in consecutive rows — so there is no column that means the same
 * thing twice, and the only things every result has are a name, what kind of
 * thing it is, and where it came from.
 *
 * Each row carries at most two lines: the name, and the passage that matched.
 * That second line is the whole reason a corpus-wide search is worth having
 * over a per-type filter box — it is what answers "which of these nine
 * identically-named things did I mean".
 *
 * Stays a server component; only the name is a client component, and its loader
 * is bound here per row rather than imported.
 */

/**
 * The query field and the result count.
 *
 * Not `ListToolbar`. There the field narrows a list already on screen and the
 * count is withheld until something has been narrowed, because an unfiltered
 * total answers no question anyone asked. Here the field *is* the question and
 * the count *is* the answer, so it always shows.
 *
 * The page carries its own field rather than relying on the one in the top bar,
 * which cannot be prefilled: reading the current query there would make every
 * page in the app depend on `useSearchParams`.
 */
export function SearchToolbar({
  query,
  matched,
  types,
}: {
  query: string;
  matched: number | null;
  /** Carried through the form, so searching again keeps the rail's selection. */
  types: string[];
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
      <Box asChild flex="1" minW="0" maxW="lg">
        <form action="/search" method="get">
          {types.length > 0 ? (
            <input type="hidden" name="type" value={types.join(",")} />
          ) : null}
          <Box
            asChild
            w="full"
            px="2.5"
            py="1"
            fontFamily="ui"
            fontSize="sm"
            bg="bg"
            borderWidth="1px"
            borderColor="border"
            rounded="l1"
            _focusVisible={{ borderColor: "brand" }}
          >
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search the compendium"
              aria-label="Search the compendium"
              // The one field on the page someone came here to use.
              autoFocus
            />
          </Box>
        </form>
      </Box>

      {matched === null ? null : (
        <Text
          fontFamily="ui"
          fontSize="2xs"
          color="fg.subtle"
          fontVariantNumeric="tabular-nums"
          whiteSpace="nowrap"
          aria-live="polite"
        >
          {matched.toLocaleString("en-US")}{" "}
          {matched === 1 ? "result" : "results"}
        </Text>
      )}
    </Box>
  );
}

export function SearchResults({
  rows,
  query,
  open,
}: {
  rows: SearchResult[];
  /** Echoed in the empty state, so a typo is visible rather than mysterious. */
  query: string;
  /** Renders one entity for the aside. The route supplies its function. */
  open: (
    type: BrowsableType,
    source: string,
    slug: string,
  ) => Promise<ReactNode>;
}) {
  if (rows.length === 0) return <NoMatches query={query} />;

  return (
    <Stack as="ul" gap="0" listStyleType="none">
      {rows.map((row) => (
        <ResultRow key={row.id} row={row} open={open} />
      ))}
    </Stack>
  );
}

function ResultRow({
  row,
  open,
}: {
  row: SearchResult;
  open: (
    type: BrowsableType,
    source: string,
    slug: string,
  ) => Promise<ReactNode>;
}) {
  /*
   * Three ways a name can behave, in descending order of how good they are.
   * Much of the corpus still has no renderer and no page — a deity, a card, a
   * vehicle — and those rows print as plain text rather than as a link that
   * would 404, which is the same rule the reader's cross-references follow.
   */
  const openable =
    row.href !== null &&
    isBrowsable(row.entityType) &&
    ASIDE_TYPES.has(row.entityType);

  return (
    <Box
      as="li"
      position="relative"
      px="4"
      py="3"
      borderBottomWidth="1px"
      borderColor="border"
      _hover={{ bg: "bg.muted" }}
    >
      <Box
        display="flex"
        alignItems="baseline"
        justifyContent="space-between"
        gap="4"
      >
        <Text
          fontFamily="ui"
          fontSize="sm"
          fontWeight="medium"
          color="fg"
          minW="0"
        >
          {openable ? (
            <Box
              asChild
              color="fg"
              /* Stretched over the row, as in the browse tables, so the whole
                 result is the target rather than the words of its name. */
              _after={{ content: '""', position: "absolute", inset: 0 }}
              _hover={{ color: "brand" }}
            >
              <AsideLink
                href={row.href!}
                // Keyed exactly as the browse tables and the reader key theirs,
                // so the same entity reached three ways is one cache entry and
                // one selected row.
                entityKey={asideKey(
                  row.entityType as BrowsableType,
                  row.sourceId,
                  row.slug,
                )}
                label={row.name}
                load={open.bind(
                  null,
                  row.entityType as BrowsableType,
                  row.sourceId,
                  row.slug,
                )}
              >
                {row.name}
              </AsideLink>
            </Box>
          ) : row.href ? (
            <Box
              asChild
              color="fg"
              _after={{ content: '""', position: "absolute", inset: 0 }}
              _hover={{ color: "brand" }}
            >
              <NextLink href={row.href}>{row.name}</NextLink>
            </Box>
          ) : (
            row.name
          )}

          {/*
            A fragment's name means nothing on its own: 847 subclass features
            and 69 subraces are called things like "Extra Attack" and "Fire".
            The parent is what makes the row readable.
          */}
          {row.parentName ? (
            <Text as="span" color="fg.subtle" fontWeight="normal">
              {" — "}
              {row.parentName}
            </Text>
          ) : null}
        </Text>

        <Box
          display="flex"
          alignItems="baseline"
          gap="2.5"
          flexShrink="0"
          fontFamily="ui"
          fontSize="2xs"
          letterSpacing="wide"
          textTransform="uppercase"
          color="fg.subtle"
          whiteSpace="nowrap"
        >
          <Box as="span">{typeLabel(row.entityType)}</Box>
          <Box as="span" data-col-optional="">
            {row.sourceId}
          </Box>
        </Box>
      </Box>

      <Snippet row={row} />
    </Box>
  );
}

/**
 * The passage that matched.
 *
 * Whether there is one to show is decided in the query, not here — see
 * `HEADLINE_OPTIONS`. It comes back null for every row whose name already
 * explains the match, which is most of them, so a result list is mostly single
 * lines with a second line exactly where one is owed.
 */
function Snippet({ row }: { row: SearchResult }) {
  const parts = parseSnippet(row.snippet);
  if (parts.length === 0) return null;

  return (
    <Text
      mt="1"
      fontFamily="body"
      fontSize="xs"
      color="fg.muted"
      lineHeight="short"
      lineClamp="2"
    >
      {parts.map((part, index) =>
        part.match ? (
          <Box
            // Parts are positional; there is no id to key them by.
            key={index}
            as="mark"
            bg="brand.subtle"
            color="fg"
            fontWeight="medium"
          >
            {part.text}
          </Box>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </Text>
  );
}

function NoMatches({ query }: { query: string }) {
  return (
    <Box px="6" py="16" textAlign="center">
      <Text fontFamily="body" fontSize="md" color="fg.muted">
        Nothing matches “{query}”.
      </Text>
      <Text mt="2" fontFamily="ui" fontSize="xs" color="fg.subtle">
        Misspellings are forgiven, so this is more likely a gap in the corpus
        than a typo.
      </Text>
    </Box>
  );
}

/** Shown before anything has been searched for. */
export function SearchPrompt() {
  return (
    <Box px="6" py="16" textAlign="center">
      <Text fontFamily="body" fontSize="md" color="fg.muted">
        Search every spell, creature, item and chapter.
      </Text>
      <Text mt="2" fontFamily="ui" fontSize="xs" color="fg.subtle">
        Type at least two characters.
      </Text>
    </Box>
  );
}
