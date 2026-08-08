import { Box, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { withValue, type QueryParams } from "@/lib/query-params";

/**
 * The toolbar above a list and the pager below it. Both are server-rendered and
 * driven entirely by the URL — the search field is a plain GET form, so it works
 * before hydration and needs no client state.
 */

/** Filter params carried through the search form so searching does not reset them. */
const CARRIED_KEYS = ["level", "school", "time", "class", "conc", "ritual", "sort"];

export function ListToolbar({
  params,
  matched,
  filtered,
  basePath,
}: {
  params: QueryParams;
  matched: number;
  /** Whether any filter is applied. A count is only shown once one is. */
  filtered: boolean;
  basePath: string;
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
      <form action={basePath} method="get">
        {/* Filters survive a search; page does not, since the results change. */}
        {CARRIED_KEYS.map((key) => {
          const value = params[key];
          const single = Array.isArray(value) ? value[0] : value;
          return single ? (
            <input key={key} type="hidden" name={key} value={single} />
          ) : null;
        })}
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
            name="q"
            defaultValue={typeof params["q"] === "string" ? params["q"] : ""}
            placeholder="Search spells"
            aria-label="Search spells by name"
          />
        </Box>
      </form>

      {/* A count only once something has been narrowed — an unfiltered total
          answers no question the reader asked. */}
      {filtered ? (
        <Text
          fontFamily="ui"
          fontSize="2xs"
          color="fg.subtle"
          fontVariantNumeric="tabular-nums"
          whiteSpace="nowrap"
        >
          {matched} {matched === 1 ? "spell" : "spells"}
        </Text>
      ) : null}
    </Box>
  );
}

/** Hidden entirely when there is only one page. */
export function Pager({
  params,
  page,
  pageCount,
  basePath,
}: {
  params: QueryParams;
  page: number;
  pageCount: number;
  basePath: string;
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
      <PageLink
        href={`${basePath}${withValue(params, "page", String(page - 1))}`}
        disabled={page <= 1}
      >
        ← Previous
      </PageLink>

      <Text
        fontFamily="ui"
        fontSize="2xs"
        color="fg.subtle"
        fontVariantNumeric="tabular-nums"
      >
        Page {page} of {pageCount}
      </Text>

      <PageLink
        href={`${basePath}${withValue(params, "page", String(page + 1))}`}
        disabled={page >= pageCount}
      >
        Next →
      </PageLink>
    </Box>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <Text
        fontFamily="ui"
        fontSize="xs"
        color="fg.subtle"
        opacity="0.5"
        aria-disabled="true"
      >
        {children}
      </Text>
    );
  }

  return (
    <Box
      asChild
      fontFamily="ui"
      fontSize="xs"
      color="brand"
      px="2"
      py="1"
      rounded="l1"
      _hover={{ bg: "brand.subtle" }}
    >
      <NextLink href={href}>{children}</NextLink>
    </Box>
  );
}
