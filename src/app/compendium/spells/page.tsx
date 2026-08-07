import type { Metadata } from "next";
import { SpellBrowser } from "@/components/compendium/spell-browser";
import { filtersFromSearch } from "@/lib/content/spell-browse";
import { allSpells } from "@/server/db/queries/spells";

export const metadata: Metadata = {
  title: "Spells",
  description:
    "Every spell, filtered by level, school, casting time and class.",
};

/**
 * The spell browse route.
 *
 * Fetches the whole list once and hands it to the client, which does all the
 * filtering. The URL is still parsed here rather than only in the browser, so
 * the server's first render is already filtered — arriving on a link to
 * "2nd-level bard spells" must not paint 525 rows and then remove most of them.
 */
export default async function SpellsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const spells = await allSpells();

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) search.set(key, single);
  }

  return (
    <SpellBrowser spells={spells} initialFilters={filtersFromSearch(search)} />
  );
}
