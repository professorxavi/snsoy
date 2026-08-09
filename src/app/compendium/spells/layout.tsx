import type { ReactNode } from "react";
import { AsideProvider } from "@/components/compendium/aside-context";
import { AsideSlot } from "@/components/compendium/aside-slot";
import { BrowseFrame } from "@/components/layout";

/**
 * The spells section shell.
 *
 * `children` is the list or a spell's own page. The aside beside it is client
 * state rather than a route: a row click calls a server function and drops the
 * reply into `AsideSlot`, so the list is never unmounted and the URL never
 * moves. `children` is passed through the provider as a prop, which keeps the
 * list server-rendered despite the client boundary above it.
 *
 * No filter UI here: facet counts depend on query params, and a layout never
 * receives them, so the rail belongs to the page.
 */
export default function SpellsLayout({ children }: { children: ReactNode }) {
  return (
    <AsideProvider>
      <BrowseFrame aside={<AsideSlot />}>{children}</BrowseFrame>
    </AsideProvider>
  );
}
