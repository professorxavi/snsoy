import type { ReactNode } from "react";
import { AsideSlot } from "@/components/compendium/aside-slot";
import { openEntityAside } from "@/app/aside-actions";

/**
 * The sources shell.
 *
 * Adds nothing around the reader — a chapter owns its own layout — beyond the
 * aside, which floats over the page rather than taking a column from it. The
 * loader is bound here because a server component is the only place a server
 * function may be handed to the client without breaking the client manifest in
 * development.
 */
export default function SourcesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AsideSlot load={openEntityAside} variant="drawer" />
    </>
  );
}
