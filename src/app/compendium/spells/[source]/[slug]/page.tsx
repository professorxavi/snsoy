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
 * The canonical page for one spell.
 *
 * This route has to exist and be complete regardless of how good the browse
 * aside is. Roughly 118,000 inline cross-reference tags resolve to pages like
 * this one, and a cold arrival — a pasted link, a search result, a `{@spell}`
 * tag inside a chapter — must render the whole spell with its own way back.
 * The aside intercepts this route; it does not replace it.
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

  // Both are per-spell and independent, so they overlap rather than queue.
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
