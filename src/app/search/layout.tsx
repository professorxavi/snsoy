import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";
import { BrowseFrame } from "@/components/layout";

/**
 * The search section shell.
 *
 * Identical to the browse sections': a result click calls a server function and
 * drops the reply into `AsideSlot`, so the results are never unmounted, the
 * query stays in the URL and reading nine candidates in turn leaves the history
 * stack where it found it. Coming back from a wrong guess is what search needs
 * most, and here there is nothing to come back from.
 *
 * No filter UI here — facet counts depend on the query, and a layout never
 * receives search params.
 */
export default function SearchLayout({ children }: { children: ReactNode }) {
  return (
    <BrowseFrame aside={<AsideSlot load={openEntityAside} />}>
      {children}
    </BrowseFrame>
  );
}
