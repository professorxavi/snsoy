import { Box, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { AsideClose } from "@/components/compendium/aside-close";
import { SpellDetail } from "@/components/compendium/spell-detail";
import { BrowseAside } from "@/components/layout";
import { collectReferences } from "@/lib/content/references";
import {
  inboundReferences,
  resolveReferences,
} from "@/server/db/queries/references";
import { getSpell } from "@/server/db/queries/spells";

/**
 * A spell opened from the list.
 *
 * Intercepts the spell's own route, so clicking a row updates the URL to
 * `/compendium/spells/phb/fireball` — shareable, and back closes the aside —
 * without unmounting the list beneath, preserving scroll and filter state.
 *
 * Renders the same `SpellDetail` as the full page, with nothing abbreviated.
 */
export default async function SpellAside({
  params,
}: {
  params: Promise<{ source: string; slug: string }>;
}) {
  const { source, slug } = await params;
  const spell = await getSpell(source, slug);

  if (!spell) notFound();

  const [refs, inbound] = await Promise.all([
    resolveReferences(collectReferences(spell.data)),
    inboundReferences(spell.id),
  ]);

  return (
    <BrowseAside>
      <AsideClose />
      <SpellDetail
        spell={spell}
        refs={refs}
        inbound={inbound}
        density="aside"
      />

      {/* The way out of the aside into the full page. */}
      <Box px="4" pb="6">
        <Text
          asChild
          fontFamily="ui"
          fontSize="2xs"
          letterSpacing="wide"
          textTransform="uppercase"
          color="brand"
          _hover={{ textDecoration: "underline" }}
        >
          <NextLink href={`/compendium/spells/${source}/${slug}`}>
            Open full page →
          </NextLink>
        </Text>
      </Box>
    </BrowseAside>
  );
}
