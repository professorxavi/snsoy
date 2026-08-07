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
 * This intercepts the spell's canonical route, so clicking a row navigates to
 * `/compendium/spells/phb/fireball` — the URL updates, the link is shareable,
 * and back closes the aside — while the list underneath is never unmounted.
 * Scroll position and filter state survive, which is the whole reason browsing
 * works this way: comparing 525 spells means opening a dozen of them, and
 * losing your place each time would make the list useless.
 *
 * It renders the same `SpellDetail` as the canonical page. Nothing is
 * abbreviated for the aside — someone who lands on this URL cold has to see
 * what the person who sent it saw.
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

      {/* The way out of a 400px column into the full page. */}
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
