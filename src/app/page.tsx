import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { ReadingColumn } from "@/components/shell";

export default function Home() {
  return (
    <ReadingColumn>
      <Stack gap="5">
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
    </ReadingColumn>
  );
}
