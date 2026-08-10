import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";
import { BrowseFrame } from "@/components/layout";

/**
 * The actions section shell. The same arrangement the skills, conditions,
 * senses and statuses sections use: `children` is the list, and the aside
 * beside it is client state rather than a route.
 */
export default function ActionsLayout({ children }: { children: ReactNode }) {
  return (
    <BrowseFrame aside={<AsideSlot load={openEntityAside} />}>
      {children}
    </BrowseFrame>
  );
}
