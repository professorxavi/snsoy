import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";

/**
 * A spell's own page, and the aside it opens references into.
 *
 * Split from the list's layout so the two can disagree about the panel. A
 * browse list pays for the aside out of its own width, which suits a table; a
 * spell page is a measured reading column and must not rewrap while it is read,
 * so here the panel floats over it.
 *
 * The page itself wraps its body in `AsideLinks`. Without this slot that
 * wrapper would have nowhere to open into.
 */
export default function SpellPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AsideSlot load={openEntityAside} variant="drawer" />
    </>
  );
}
