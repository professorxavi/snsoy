"use client";

import {
  Box,
  CloseButton,
  Drawer,
  Flex,
  IconButton,
  Portal,
  Stack,
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

export function TopNav() {
  const pathname = usePathname();

  return (
    <Flex
      as="header"
      position="sticky"
      top="0"
      zIndex="docked"
      align="center"
      gap="4"
      h="topbar"
      px="3"
      bg="brand"
      color="brand.contrast"
    >
      <MobileNav pathname={pathname} />

      <Box
        asChild
        fontFamily="display"
        fontSize="md"
        letterSpacing="wide"
        whiteSpace="nowrap"
      >
        <NextLink href="/">S&amp;S</NextLink>
      </Box>

      <Flex
        as="nav"
        aria-label="Main"
        gap="0.5"
        display={{ base: "none", md: "flex" }}
      >
        {LINKS.map((link) => {
          // `startsWith` so a nested entity route keeps its section highlighted.
          const active = pathname.startsWith(link.href);
          return (
            <Box
              key={link.href}
              asChild
              fontSize="sm"
              fontWeight={active ? "semibold" : "normal"}
              px="2.5"
              py="1"
              rounded="l1"
              opacity={active ? 1 : 0.72}
              bg={active ? "whiteAlpha.300" : "transparent"}
              _hover={{ opacity: 1, bg: "whiteAlpha.200" }}
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
        color="brand.contrast"
        _hover={{ bg: "whiteAlpha.300" }}
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
          color="brand.contrast"
          _hover={{ bg: "whiteAlpha.300" }}
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
                S&amp;S
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
