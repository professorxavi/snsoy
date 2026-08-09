import type { ReactNode } from "react";
import { openEntityAside } from "@/app/aside-actions";
import { AsideSlot } from "@/components/compendium/aside-slot";

/**
 * The races shell.
 *
 * Adds only the aside, which floats over the page rather than taking a column
 * from it — a race page is a measured reading column like a chapter, and must
 * not rewrap while it is read.
 *
 * The slot renders nothing until something is opened, and only the race page
 * itself wraps its body in `AsideLinks`: the index is a list of races, where
 * clicking one navigates to it, and that is the decision recorded for races
 * from the start.
 */
export default function RacesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AsideSlot load={openEntityAside} variant="drawer" />
    </>
  );
}
