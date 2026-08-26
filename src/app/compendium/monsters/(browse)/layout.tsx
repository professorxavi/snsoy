import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";
import { BrowseFrame } from "@/components/layout";

/**
 * The creatures section shell.
 *
 * A row click calls a server function and drops the reply into `AsideSlot`, so
 * the list is never unmounted and the URL never moves. Its state lives in
 * `AppFrame`; this layout only decides that here the panel takes a column
 * rather than floating over the page.
 *
 * No filter UI here: facet counts depend on query params, and a layout never
 * receives them, so the rail belongs to the page.
 */
export default function MonstersLayout({ children }: { children: ReactNode }) {
  return (
    <BrowseFrame aside={<AsideSlot load={openEntityAside} />}>
      {children}
    </BrowseFrame>
  );
}
