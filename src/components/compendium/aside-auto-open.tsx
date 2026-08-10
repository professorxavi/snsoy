"use client";

import { useEffect, type ReactNode } from "react";
import { useAside } from "./aside-context";

/**
 * Opens one entity in the aside on arrival, because the URL asked for it.
 *
 * The only thing in the app that opens the panel without a click, and it exists
 * for one reason: the typeahead. Picking "Goblin" from the dropdown has to
 * *show* the goblin, and a creature has no page — so the destination is the
 * results page plus an instruction about what to open, and this is what carries
 * the instruction out.
 *
 * **Not a reversal of the decision that the aside is not routed.** What was
 * dropped there was routing as the *open mechanism*: every open pushed a
 * history entry, and reading five spells took five back presses to escape. This
 * reads the URL once, on arrival, and nothing that happens afterwards touches
 * it — open a second result and the address bar does not move. The URL is an
 * inbound instruction, not a mirror of the panel's state.
 *
 * Renders nothing. It is a behaviour, and giving it markup would put a node in
 * the results list that is not a result.
 */
export function AsideAutoOpen({
  entityKey,
  label,
  load,
}: {
  entityKey: string;
  /**
   * The entity's name, for the back button of anything opened from inside it.
   * Optional because the URL carries a slug rather than a name, and "← Back"
   * reads better than "← goblin-boss".
   */
  label?: string;
  /**
   * The bound server function that renders the body. Bound by the page, a
   * server component — importing it here would leave the returned tree's client
   * modules out of the manifest and break in `next dev` only.
   */
  load: () => Promise<ReactNode>;
}) {
  const { open } = useAside();

  /*
   * An effect, because `open` sets state in a provider above this component and
   * there is no render-time way to reach it. Safe to re-run: `open` ignores a
   * key that is already the one requested, so a re-render, a facet click or a
   * page change cannot reopen what the reader has closed.
   */
  useEffect(() => {
    open(entityKey, load, { label });
  }, [open, entityKey, label, load]);

  return null;
}
