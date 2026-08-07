import { Box, Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";

const ENTRIES = [
  {
    href: "/compendium",
    title: "Compendium",
    body: "Every spell, creature, item and rule, filtered on the things you actually search by — and cross-linked to everything that mentions them.",
  },
  {
    href: "/sources",
    title: "Sources",
    body: "The full text of your books and adventures, chapter by chapter, with every reference resolved inline as you read.",
  },
  {
    href: "/characters",
    title: "Characters",
    body: "Build a character from the content you own, then play from a sheet that knows the rules behind it.",
  },
] as const;

export default function Home() {
  return (
    <Box
      as="main"
      id="main"
      px={{ base: "5", md: "10" }}
      py={{ base: "12", md: "20" }}
      pb="24"
    >
      <Box maxW="5xl" mx="auto">
        <Stack gap="5" maxW="measure">
          <Box>
            <Text
              fontFamily="display"
              fontSize="sm"
              letterSpacing="wide"
              color="brand"
              mb="1"
            >
              SWORD &amp; SORCERY
            </Text>
            <Heading
              as="h1"
              fontFamily="heading"
              fontWeight="semibold"
              fontSize={{ base: "4xl", md: "5xl" }}
              lineHeight="1.07"
              letterSpacing="tight"
              textWrap="balance"
            >
              over Yonder
            </Heading>
          </Box>

          <Text
            className="prose"
            fontFamily="body"
            fontSize="lg"
            lineHeight="1.7"
            color="fg.muted"
          >
            A compendium and character toolset for the 2014 ruleset of the fifth
            edition of the world&rsquo;s greatest role-playing game. You paid for
            the content, you should be able to access it without being forced to
            play the new edition.
          </Text>
        </Stack>

        <SimpleGrid
          columns={{ base: 1, md: 3 }}
          gap="4"
          mt={{ base: "12", md: "16" }}
        >
          {ENTRIES.map((entry) => (
            <Box
              key={entry.href}
              asChild
              display="flex"
              flexDirection="column"
              gap="2"
              p="5"
              bg="bg.panel"
              borderWidth="1px"
              borderColor="border"
              borderTopWidth="3px"
              borderTopColor="brand"
              rounded="l1"
              transition="border-color .12s, background .12s"
              _hover={{
                bg: "bg.muted",
                borderColor: "border.emphasized",
                borderTopColor: "brand",
              }}
            >
              <NextLink href={entry.href}>
                <Text fontFamily="display" fontSize="xl" lineHeight="1.1">
                  {entry.title}
                </Text>
                <Text
                  className="prose"
                  fontFamily="body"
                  fontSize="sm"
                  lineHeight="1.6"
                  color="fg.muted"
                >
                  {entry.body}
                </Text>
              </NextLink>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
