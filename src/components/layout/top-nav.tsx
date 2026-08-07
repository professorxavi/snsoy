"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { ColorModeButton } from "@/components/ui/color-mode";

/**
 * The top bar — the app's voice, so it is the one full-bleed purple surface in
 * the product. Everything cyan stays inline in content; nothing in here is.
 */

const LINKS = [
  { href: "/compendium", label: "Compendium" },
  { href: "/sources", label: "Sources" },
  { href: "/search", label: "Search" },
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

      <Flex as="nav" aria-label="Main" gap="0.5" display={{ base: "none", md: "flex" }}>
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
              <NextLink href={link.href} aria-current={active ? "page" : undefined}>
                {link.label}
              </NextLink>
            </Box>
          );
        })}
      </Flex>

      {/* Placeholder until omnisearch exists — it lands after the first few
          compendium slices, once there is enough indexed variety for ranking
          work to mean anything. */}
      <Text
        ml="auto"
        fontSize="xs"
        px="2.5"
        py="1"
        rounded="l1"
        minW={{ base: "auto", sm: "44" }}
        bg="whiteAlpha.200"
        borderWidth="1px"
        borderColor="whiteAlpha.300"
        opacity={0.85}
        display={{ base: "none", sm: "block" }}
      >
        Search…
      </Text>

      <ColorModeButton color="brand.contrast" _hover={{ bg: "whiteAlpha.300" }} />
    </Flex>
  );
}
