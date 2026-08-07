import type { ReactNode } from "react";
import { BrowseFrame } from "@/components/layout";

/**
 * The spells section shell.
 *
 * `children` is either the list or a spell's canonical page; `aside` is the
 * parallel-route slot an intercepting route fills when a row is clicked. Both
 * live under this one layout so that clicking a row swaps the *slot* without
 * unmounting the list — scroll position and filter state survive, which is the
 * entire point of opening entities in place.
 *
 * The layout deliberately holds no filter UI. Facet counts depend on the
 * current filters, filters live in query params, and a layout never receives
 * query params — so the rail belongs to the page.
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
