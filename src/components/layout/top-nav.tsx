"use client";

import { Box, Flex } from "@chakra-ui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { ColorModeButton } from "@/components/ui/color-mode";

/** No Search link: the search box on the right is the only entry point. */
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

      {/* A plain GET form, so Enter lands on `/search?q=…` with no JavaScript.
          The results page is not built yet. */}
      <Box asChild ml="auto">
        <form action="/search" method="get">
          <Box
            asChild
            fontSize="xs"
            px="2.5"
            py="1"
            rounded="l1"
            w={{ base: "32", sm: "44" }}
            bg="whiteAlpha.200"
            borderWidth="1px"
            borderColor="whiteAlpha.300"
            color="brand.contrast"
            _placeholder={{ color: "brand.contrast", opacity: 0.7 }}
            _focusVisible={{
              bg: "whiteAlpha.300",
              borderColor: "whiteAlpha.500",
            }}
          >
            <input
              type="search"
              name="q"
              placeholder="Search…"
              aria-label="Search the compendium"
            />
          </Box>
        </form>
      </Box>

      <ColorModeButton
        color="brand.contrast"
        _hover={{ bg: "whiteAlpha.300" }}
      />
    </Flex>
  );
}
