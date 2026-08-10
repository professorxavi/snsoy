"use client";

import { Box, Flex } from "@chakra-ui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
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

      <ColorModeButton
        color="brand.contrast"
        _hover={{ bg: "whiteAlpha.300" }}
      />

      {/* Rides the bottom edge of the bar. Sticky is a positioned element, so
          this Flex is already the containing block it needs. */}
      <RouteProgress />
    </Flex>
  );
}
