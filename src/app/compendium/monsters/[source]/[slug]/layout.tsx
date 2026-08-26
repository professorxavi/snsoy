import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";

/**
 * A creature's own page, and the aside it opens references into.
 *
 * Split from the list's layout so the two can disagree about the panel. The
 * browse list pays for the aside out of its own width, which suits a table; a
 * creature page is a measured reading column and must not rewrap while it is
 * read, so here the panel floats over it.
 */
export default function MonsterPageLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <AsideSlot load={openEntityAside} variant="drawer" />
    </>
  );
}
