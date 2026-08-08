import type { ReactNode } from "react";
import { BrowseFrame } from "@/components/layout";

/**
 * The spells section shell.
 *
 * `children` is the list or a spell's own page; `aside` is the parallel-route
 * slot the intercepting route fills when a row is clicked. Sharing one layout
 * means clicking a row swaps the slot without unmounting the list, so scroll
 * position and filter state survive.
 *
 * No filter UI here: facet counts depend on query params, and a layout never
 * receives them, so the rail belongs to the page.
 */
export default function SpellsLayout({
  children,
  aside,
}: {
  children: ReactNode;
  aside: ReactNode;
}) {
  return <BrowseFrame aside={aside}>{children}</BrowseFrame>;
}
