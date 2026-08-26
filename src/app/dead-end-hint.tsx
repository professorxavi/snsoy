"use client";

import { Box, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { readDeadEnd } from "@/lib/dead-end";

/**
 * The signpost on the 404 page, for the addresses that were reaching for
 * something real.
 *
 * A client component because the path is the only input and the 404 has no
 * route to hand it over: Next renders this page for URLs that matched nothing,
 * so there are no params, and it is prerendered rather than built per request.
 * `usePathname` is what knows, and it only knows in the browser.
 */
export function DeadEndHint() {
  /*
   * Held back one pass on purpose. The prerendered HTML cannot contain the
   * path, so rendering the hint on the first client pass instead of after
   * hydration is a mismatch — React would discard the tree and warn.
   *
   * `useSyncExternalStore` rather than a `useState` flag set from an effect:
   * it states the server and client snapshots outright, which is what that
   * pattern was imitating, and it does not write state from inside an effect
   * (`react-hooks/set-state-in-effect`, which the aside context was bitten by
   * for the same reason).
   */
  const hydrated = useSyncExternalStore(subscribeToNothing, onClient, onServer);

  const pathname = usePathname();
  const deadEnd = hydrated ? readDeadEnd(pathname) : null;

  if (!deadEnd) return null;

  const { label, listHref } = deadEnd;

  return (
    <Box
      borderLeftWidth="3px"
      borderColor="brand"
      bg="bg.panel"
      pl={{ base: "4", md: "5" }}
      pr="4"
      py="4"
      rounded="l1"
      roundedLeft="none"
      maxW="measure"
    >
      <Stack gap="3">
        <Text className="prose" fontFamily="body" fontSize="sm" lineHeight="1.65">
          {label} have no page of their own. They open in a panel{" "}
          {listHref ? "beside their list" : "wherever the books cite them"}, so
          you can read one without losing the page you were on.
        </Text>

        <Text
          asChild
          fontFamily="ui"
          fontSize="2xs"
          fontWeight="semibold"
          letterSpacing="wide"
          textTransform="uppercase"
          color="brand"
          _hover={{ textDecoration: "underline" }}
        >
          <NextLink href={listHref ?? "/compendium"}>
            {listHref ? `Browse ${label}` : "Browse the compendium"} →
          </NextLink>
        </Text>
      </Stack>
    </Box>
  );
}

/** Never changes after hydration, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;
