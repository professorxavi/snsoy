import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";
import { BrowseFrame } from "@/components/layout";

/**
 * The conditions section shell — the list and the aside beside it, the same
 * arrangement the skills and spells sections use. The aside is client state
 * rather than a route, so the list is never unmounted and the URL never moves.
 */
export default function ConditionsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <BrowseFrame aside={<AsideSlot load={openEntityAside} />}>
      {children}
    </BrowseFrame>
  );
}
