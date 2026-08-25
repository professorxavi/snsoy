import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";

/**
 * A class's own page, and the aside it opens references into.
 *
 * The classes list has no layout and wants no panel — clicking a class
 * navigates to it by design — so this is the only aside in the section, and it
 * belongs to the reading page rather than to the section as a whole.
 *
 * Drawer rather than column: a class page is a measured reading column, and a
 * panel that took width from it would rewrap the page under the reader.
 */
export default function ClassPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AsideSlot load={openEntityAside} variant="drawer" />
    </>
  );
}
