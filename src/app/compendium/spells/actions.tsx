"use server";

import { Box, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { SpellDetail } from "@/components/compendium/spell-detail";
import { collectReferences } from "@/lib/content/references";
import { hrefFor } from "@/lib/routes";
import {
  inboundReferences,
  resolveReferences,
} from "@/server/db/queries/references";
import { getSpell } from "@/server/db/queries/spells";

/**
 * One spell, rendered on the server for the browse aside.
 *
 * Opening a spell is a call, not a navigation. The row hands this function to
 * the client already bound to its own source and slug; the client awaits it and
 * drops the returned tree into the aside. Nothing about the URL changes, so
 * reading twenty spells leaves the history stack exactly as it found it — which
 * the intercepting route this replaced could not do, since every open pushed an
 * entry and "close" had to unwind them one at a time.
 *
 * Returning rendered JSX rather than JSON is what lets `SpellDetail` and the
 * whole `Entries` renderer stay server components: the reply is an RSC payload,
 * the same kind the canonical page streams, so none of it reaches the bundle.
 *
 * **Bind this in a server component.** Importing it into a client component
 * instead leaves the returned tree's client modules out of the client manifest,
 * and `next dev` then fails to resolve Chakra and `next/link` at reply time.
 * A production build papers over it, so the breakage shows up only locally.
 */
export async function openSpellAside(
  source: string,
  slug: string,
): Promise<ReactNode> {
  const spell = await getSpell(source, slug);

  // An action cannot call `notFound()` — there is no route to fail. The aside
  // says so in place instead, and the list underneath is untouched.
  if (!spell) return <AsideMessage>No such spell.</AsideMessage>;

  // Independent queries, so they overlap rather than queue.
  const [refs, inbound] = await Promise.all([
    resolveReferences(collectReferences(spell.data)),
    inboundReferences(spell.id),
  ]);

  const href = hrefFor({
    entityType: "spell",
    sourceId: spell.sourceId,
    slug: spell.slug,
  });

  return (
    <>
      <SpellDetail spell={spell} refs={refs} inbound={inbound} density="aside" />

      {/*
        The way out of the aside into the full page. It matters more than it did
        under the intercepting route: the aside no longer puts the spell's URL in
        the address bar, so this is now the only way to reach a shareable link.
      */}
      {href ? (
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
            <NextLink href={href}>Open full page →</NextLink>
          </Text>
        </Box>
      ) : null}
    </>
  );
}

function AsideMessage({ children }: { children: ReactNode }) {
  return (
    <Box px="4" py="6">
      <Text fontFamily="body" fontSize="sm" color="fg.muted">
        {children}
      </Text>
    </Box>
  );
}
