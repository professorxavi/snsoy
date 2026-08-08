import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpellDetail } from "@/components/compendium/spell-detail";
import { ReadingColumn } from "@/components/layout";
import { collectReferences } from "@/lib/content/references";
import { spellSubtitle } from "@/lib/content/spells";
import {
  inboundReferences,
  resolveReferences,
} from "@/server/db/queries/references";
import { getSpell } from "@/server/db/queries/spells";

/**
 * The full page for one spell, and the target every inline `{@spell}` tag
 * resolves to. The browse aside intercepts this route rather than replacing it,
 * so this must stand alone for anyone arriving from a link or a search result.
 */

interface RouteParams {
  params: Promise<{ source: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { source, slug } = await params;
  const spell = await getSpell(source, slug);

  if (!spell) return { title: "Not found" };

  return {
    title: `${spell.name} · Spells`,
    description: `${spellSubtitle(spell.level, spell.school)}. ${spell.sourceName}${
      spell.page ? `, p. ${spell.page}` : ""
    }.`,
  };
}

export default async function SpellPage({ params }: RouteParams) {
  const { source, slug } = await params;
  const spell = await getSpell(source, slug);

  if (!spell) notFound();

  // Independent queries, so they overlap rather than queue.
  const [refs, inbound] = await Promise.all([
    resolveReferences(collectReferences(spell.data)),
    inboundReferences(spell.id),
  ]);

  return (
    <ReadingColumn>
      <SpellDetail spell={spell} refs={refs} inbound={inbound} />
    </ReadingColumn>
  );
}
