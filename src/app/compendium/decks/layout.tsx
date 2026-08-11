import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";
import { BrowseFrame } from "@/components/layout";

/**
 * The decks section shell.
 *
 * `children` is the list; the aside beside it is client state rather than a
 * route, so opening one never unmounts the list or moves the URL. It matters
 * more here than on most lists: a deck's panel is a list of its cards, and
 * following one of them has to leave the deck list standing behind it.
 */
export default function DecksLayout({ children }: { children: ReactNode }) {
  return (
    <BrowseFrame aside={<AsideSlot load={openEntityAside} />}>
      {children}
    </BrowseFrame>
  );
}
