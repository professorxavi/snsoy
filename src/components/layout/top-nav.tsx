"use client";

import {
  Box,
  CloseButton,
  Drawer,
  Flex,
  IconButton,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LuMenu } from "react-icons/lu";
import { ColorModeButton } from "@/components/ui/color-mode";
import { RouteProgress } from "./route-progress";
import { SearchBox } from "./search-box";

const LINKS = [
  { href: "/compendium", label: "Compendium" },
  { href: "/sources", label: "Sources" },
] as const;

/**
 * The top bar: a ground step with a quiet purple keyline, not a filled purple slab.
 *
 * The app still speaks in purple — the keyline under the bar, the ampersand in
 * the wordmark, the focus ring — but as printed rules rather than a painted
 * surface. A fully saturated bar made the chrome the brightest thing on screen,
 * above the text it exists to frame, and a filled bar over pill navigation is
 * the shape every generic app shell takes.
 */
export function TopNav() {
  const pathname = usePathname();

  return (
    <Flex
      as="header"
      position="sticky"
      top="0"
      zIndex="docked"
      align="center"
      gap={{ base: "3", md: "6" }}
      h="topbar"
      px="4"
      bg="bg.panel"
      color="fg"
      borderBottomWidth="2px"
      borderColor="brand.line"
    >
      <MobileNav pathname={pathname} />

      <Box
        asChild
        fontFamily="display"
        fontSize="md"
        letterSpacing="wide"
        whiteSpace="nowrap"
        lineHeight="1"
      >
        <NextLink href="/">
          S
          <Text as="span" color="brand">
            &amp;
          </Text>
          S
        </NextLink>
      </Box>

      <Flex
        as="nav"
        aria-label="Main"
        gap="5"
        h="100%"
        align="center"
        display={{ base: "none", md: "flex" }}
      >
        {LINKS.map((link) => {
          // `startsWith` so a nested entity route keeps its section highlighted.
          const active = pathname.startsWith(link.href);
          return (
            <Box
              key={link.href}
              asChild
              fontFamily="ui"
              fontSize="2xs"
              fontWeight="medium"
              letterSpacing="widest"
              textTransform="uppercase"
              color={active ? "fg" : "fg.muted"}
              h="100%"
              display="flex"
              alignItems="center"
              position="relative"
              _hover={{ color: "fg" }}
              /*
               * The active marker sits on the bar's own keyline and replaces it
               * under the word — the way a running head marks a section, rather
               * than a filled pill.
               */
              _after={
                active
                  ? {
                      content: '""',
                      position: "absolute",
                      insetInline: 0,
                      bottom: "-2px",
                      h: "2px",
                      bg: "fg",
                    }
                  : undefined
              }
            >
              <NextLink
                href={link.href}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </NextLink>
            </Box>
          );
        })}
      </Flex>

      {/* Still a plain GET form under the typeahead, so Enter lands on
          `/search?q=…` with no JavaScript. Not prefilled with the current
          query: reading it back would mean `useSearchParams` here, and this bar
          is on every page in the app. The results page carries its own field
          for that. */}
      <SearchBox />

      {/* On a phone this lives in the drawer instead: the bar has room for the
          search field or for everything else, and the field wins. */}
      <ColorModeButton
        display={{ base: "none", md: "inline-flex" }}
        color="fg.muted"
        _hover={{ bg: "bg.muted", color: "fg" }}
      />

      {/* Rides the bottom edge of the bar. Sticky is a positioned element, so
          this Flex is already the containing block it needs. */}
      <RouteProgress />
    </Flex>
  );
}

/**
 * The same links as the bar, in a drawer, below `md`.
 *
 * Under that width the bar's nav is `display: none` and nothing replaced it —
 * the only way to reach the compendium from a phone was the wordmark and then
 * a link on the home page. The search field stays in the bar rather than moving
 * in here: on a phone it is the primary action, not a secondary one.
 *
 * Controlled rather than left to itself, because a link is not a close button.
 * Following one navigates without unmounting the bar, so the drawer would stay
 * open over the page that was just asked for.
 */
function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
      placement="start"
      size="xs"
    >
      <Drawer.Trigger asChild>
        <IconButton
          aria-label="Menu"
          variant="ghost"
          size="sm"
          display={{ base: "inline-flex", md: "none" }}
          color="fg.muted"
          _hover={{ bg: "bg.muted", color: "fg" }}
        >
          <LuMenu />
        </IconButton>
      </Drawer.Trigger>

      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title fontFamily="display" fontWeight="normal">
                S
                <Text as="span" color="brand">
                  &amp;
                </Text>
                S
              </Drawer.Title>
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Drawer.CloseTrigger>
            </Drawer.Header>

            <Drawer.Body>
              <Stack as="nav" aria-label="Main" gap="1">
                {LINKS.map((link) => {
                  const active = pathname.startsWith(link.href);
                  return (
                    <Box
                      key={link.href}
                      asChild
                      fontFamily="ui"
                      fontSize="sm"
                      fontWeight={active ? "semibold" : "normal"}
                      color={active ? "brand" : "fg.muted"}
                      px="2"
                      py="2"
                      rounded="l1"
                      bg={active ? "brand.subtle" : "transparent"}
                    >
                      <NextLink
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                      >
                        {link.label}
                      </NextLink>
                    </Box>
                  );
                })}
              </Stack>
            </Drawer.Body>

            <Drawer.Footer justifyContent="flex-start">
              <ColorModeButton />
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
