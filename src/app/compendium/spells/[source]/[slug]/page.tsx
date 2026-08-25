import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { openEntityAside } from "@/app/aside-actions";
import { AsideLinks } from "@/components/compendium/aside-links";
import { SpellDetail } from "@/components/compendium/spell-detail";
import { ReadingColumn } from "@/components/layout";
import { collectReferences } from "@/lib/content/references";
import { spellSubtitle } from "@/lib/content/spells";
import { resolveReferences } from "@/server/db/queries/references";
import { getSpell } from "@/server/db/queries/spells";

/**
 * The full page for one spell, and the target every inline `{@spell}` tag
 * resolves to. Reached cold from a link or a search result as often as from the
 * browse list, so it stands alone and shares nothing with the list's layout.
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

  const refs = await resolveReferences(collectReferences(spell.data));

  return (
    <ReadingColumn>
      {/*
        A spell's text cites conditions, creatures and other spells — ~380 tags
        across 250 spells — and following one used to cost the reader the spell
        they were reading. They open beside it instead, in the drawer this
        route's own layout provides.
      */}
      <AsideLinks load={openEntityAside}>
        <SpellDetail spell={spell} refs={refs} />
      </AsideLinks>
    </ReadingColumn>
  );
}
