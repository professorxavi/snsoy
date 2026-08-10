import { Box, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { sourceHref } from "@/lib/routes";

/** The source and name shared by every entity rendered in an aside. */
export function AsideIdentity({
  sourceId,
  sourceName,
  page,
  name,
  children,
}: {
  sourceId: string;
  sourceName: string;
  page: number | null;
  name: string;
  children?: ReactNode;
}) {
  return (
    <Box>
      <Text
        fontFamily="ui"
        fontSize="2xs"
        fontWeight="medium"
        letterSpacing="widest"
        textTransform="uppercase"
        color="fg.subtle"
      >
        <Box asChild _hover={{ color: "brand" }}>
          <NextLink href={sourceHref(sourceId)}>{sourceName}</NextLink>
        </Box>
        {page ? ` · p. ${page}` : null}
      </Text>

      <Text
        as="h1"
        fontFamily="display"
        fontSize="2xl"
        lineHeight="1.05"
        letterSpacing="tight"
        textWrap="balance"
        mt="1"
      >
        {name}
      </Text>

      {children}
    </Box>
  );
}
