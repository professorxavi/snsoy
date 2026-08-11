import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";
import { BrowseFrame } from "@/components/layout";

/**
 * The recipes section shell.
 *
 * `children` is the list; the aside beside it is client state rather than a
 * route, so opening one never unmounts the list or moves the URL. Its state
 * lives in `AppFrame` — this layout only decides that here the panel takes a
 * column rather than floating over the page.
 */
export default function RecipesLayout({ children }: { children: ReactNode }) {
  return (
    <BrowseFrame aside={<AsideSlot load={openEntityAside} />}>
      {children}
    </BrowseFrame>
  );
}
