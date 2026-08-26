import { Box, Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";

const ENTRIES = [
  {
    href: "/compendium",
    title: "Compendium",
    body: "Look up what a spell does, then find every creature that casts it.",
  },
  {
    href: "/sources",
    title: "Sources",
    body: "Read a chapter the way it was printed, with nothing left to look up.",
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
            The content is paid for. Everyone at the table can read it.
          </Text>
        </Stack>

        <SimpleGrid
          columns={{ base: 1, md: 2 }}
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
