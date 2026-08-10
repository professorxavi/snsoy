import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";
import { BrowseFrame } from "@/components/layout";

/**
 * The senses section shell.
 *
 * `children` is the list, and the aside beside it is client state rather than a
 * route — the same arrangement the skills and conditions sections use. Its
 * state lives in `AppFrame`; this layout only decides that here the panel takes
 * a column rather than floating over the page.
 */
export default function SensesLayout({ children }: { children: ReactNode }) {
  return (
    <BrowseFrame aside={<AsideSlot load={openEntityAside} />}>
      {children}
    </BrowseFrame>
  );
}
