"use client";

import type { ComponentPropsWithRef, MouseEvent, ReactNode } from "react";
import { useAside } from "./aside-context";

/**
 * A row's link into the aside.
 *
 * Still a real anchor pointing at the entity's canonical page, so ⌘-click,
 * middle click, "copy link address" and a crawler all behave as they would on
 * any link. A plain left click is the only one intercepted, and it opens the
 * aside instead of navigating.
 *
 * `load` is the bound server function that renders the body. It must be bound
 * by a server component — see the note on `openSpellAside`.
 */
export function AsideLink({
  entityKey,
  load,
  children,
  ...rest
}: {
  /** Identifies this entity to the aside, and marks the row selected. */
  entityKey: string;
  load: () => Promise<ReactNode>;
} & ComponentPropsWithRef<"a">) {
  const { open, openKey } = useAside();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const modified =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.defaultPrevented || event.button !== 0 || modified) return;

    event.preventDefault();
    open(entityKey, load);
  };

  return (
    // Absent rather than "false" when unselected: the frame's `:has()` rule
    // keys off the attribute's presence to tint the row.
    <a
      {...rest}
      aria-current={openKey === entityKey ? "true" : undefined}
      onClick={onClick}
    >
      {children}
    </a>
  );
}
