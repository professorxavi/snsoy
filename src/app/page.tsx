import { Container, Heading, Stack, Text } from "@chakra-ui/react";

export default function Home() {
  return (
    <Container maxW="4xl" py={16}>
      <Stack gap={4}>
        <Heading size="3xl">snsoy</Heading>
        <Text color="fg.muted">
          A compendium and character toolset for 2014 fifth edition.
        </Text>
      </Stack>
    </Container>
  );
}
