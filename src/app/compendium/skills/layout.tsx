import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";
import { BrowseFrame } from "@/components/layout";

/**
 * The skills section shell.
 *
 * `children` is the list or a skill's own page, and the aside beside it is
 * client state rather than a route — the same arrangement the spells section
 * uses. Its state lives in `AppFrame`; this layout only decides that here the
 * panel takes a column rather than floating over the page.
 */
export default function SkillsLayout({ children }: { children: ReactNode }) {
  return (
    <BrowseFrame aside={<AsideSlot load={openEntityAside} />}>
      {children}
    </BrowseFrame>
  );
}
