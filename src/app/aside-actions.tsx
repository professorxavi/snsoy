"use server";

import { Box, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { ClassAside } from "@/components/compendium/class-aside";
import { SpellDetail } from "@/components/compendium/spell-detail";
import { ASIDE_IGNORE_ATTR } from "@/lib/aside";
import { collectReferences } from "@/lib/content/references";
import { hrefFor, type BrowsableType } from "@/lib/routes";
import { getClass } from "@/server/db/queries/classes";
import {
  inboundReferences,
  resolveReferences,
} from "@/server/db/queries/references";
import { getSpell } from "@/server/db/queries/spells";

/**
 * One entity, rendered on the server for the aside.
 *
 * Opening something is a call, not a navigation: the caller hands this function
 * to the client already bound, the client awaits it and drops the returned tree
 * into the panel. Nothing about the URL changes, so reading twenty entities
 * leaves the history stack exactly as it found it.
 *
 * Returning rendered JSX rather than JSON is what lets `SpellDetail`, the class
 * aside and the whole `Entries` renderer stay server components: the reply is an
 * RSC payload, the same kind a page streams, so none of it reaches the bundle.
 *
 * **Bind this in a server component.** Importing it into a client component
 * instead leaves the returned tree's client modules out of the client manifest,
 * and `next dev` then fails to resolve Chakra and `next/link` at reply time. A
 * production build papers over it, so the breakage shows up only locally.
 *
 * Types not handled here are never asked for — `ASIDE_TYPES` in `aside-links`
 * decides what gets intercepted, and the two lists have to agree.
 */
export async function openEntityAside(
  type: BrowsableType,
  source: string,
  slug: string,
): Promise<ReactNode> {
  switch (type) {
    case "spell":
      return spellAside(source, slug);
    case "class":
      return classAside(source, slug);
    default:
      return <AsideMessage>Nothing to show for this yet.</AsideMessage>;
  }
}

async function spellAside(source: string, slug: string): Promise<ReactNode> {
  const spell = await getSpell(source, slug);

  // An action cannot call `notFound()` — there is no route to fail. The aside
  // says so in place instead, and the page underneath is untouched.
  if (!spell) return <AsideMessage>No such spell.</AsideMessage>;

  // Independent queries, so they overlap rather than queue.
  const [refs, inbound] = await Promise.all([
    resolveReferences(collectReferences(spell.data)),
    inboundReferences(spell.id),
  ]);

  return (
    <>
      <SpellDetail spell={spell} refs={refs} inbound={inbound} density="aside" />
      <FullPageLink
        href={hrefFor({
          entityType: "spell",
          sourceId: spell.sourceId,
          slug: spell.slug,
        })}
      >
        Open full page →
      </FullPageLink>
    </>
  );
}

async function classAside(source: string, slug: string): Promise<ReactNode> {
  const found = await getClass(source, slug);
  if (!found) return <AsideMessage>No such class.</AsideMessage>;

  // Only the description is rendered here, so only its references are needed —
  // resolving the whole class would mean every feature and subclass for text
  // the aside does not print.
  const refs = await resolveReferences(collectReferences(found.fluff));

  return <ClassAside found={found} refs={refs} />;
}

/**
 * The way out of the aside into the full page. It matters more than it did when
 * the aside was a route: the URL no longer changes, so this is the only way to
 * reach a shareable link for what is open.
 */
function FullPageLink({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  if (!href) return null;

  return (
    <Box px="4" pb="6" {...{ [ASIDE_IGNORE_ATTR]: "" }}>
      <Text
        asChild
        fontFamily="ui"
        fontSize="2xs"
        letterSpacing="wide"
        textTransform="uppercase"
        color="brand"
        _hover={{ textDecoration: "underline" }}
      >
        <NextLink href={href}>{children}</NextLink>
      </Text>
    </Box>
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
