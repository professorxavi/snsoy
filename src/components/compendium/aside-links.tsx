"use client";

import type { MouseEvent, ReactNode } from "react";
import { ASIDE_IGNORE_ATTR, ASIDE_TYPES, asideKey } from "@/lib/aside";
import { parseEntityHref, type BrowsableType } from "@/lib/routes";
import { useAside } from "./aside-context";

/**
 * Makes the entity links inside it open in the aside.
 *
 * Book text is dense with cross-references — 36,000 of them across the 1,006
 * chapters — and every one is rendered by `Inline` as an ordinary anchor. Rather
 * than teach the renderer about the aside, which would mean threading a loader
 * through `Entries`, `Inline` and every entry type, this catches the click on
 * the way up and reads the entity back out of the href.
 *
 * The renderers stay untouched and the canonical pages are unaffected, because
 * nothing about the markup changes — only what happens when it is clicked
 * inside this wrapper.
 *
 * Used twice: around a chapter's body, and around the aside's own content,
 * which is what lets a reference inside an open entity open the next one.
 */
export function AsideLinks({
  children,
  load,
  nested = false,
}: {
  children: ReactNode;
  /** Renders one entity. The route supplies its server function. */
  load: (
    type: BrowsableType,
    source: string,
    slug: string,
  ) => Promise<ReactNode>;
  /**
   * True when this wraps the aside's own body rather than a page. References
   * followed from in there stack, so back returns to what sent you; links on a
   * page replace what is open, because moving between siblings is not depth.
   */
  nested?: boolean;
}) {
  const { open } = useAside();

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    // Let the browser handle anything that is not a plain left click, so
    // ⌘-click, middle click and "open in new tab" still reach the page.
    const modified =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.defaultPrevented || event.button !== 0 || modified) return;

    const anchor = (event.target as Element | null)?.closest?.("a");
    const href = anchor?.getAttribute("href");
    if (!href) return;

    // A link that has asked to be left alone — "Open full page" and the like,
    // which point at what is already open and must navigate rather than reopen.
    if (anchor?.closest(`[${ASIDE_IGNORE_ATTR}]`)) return;

    const target = parseEntityHref(href);

    // Not an entity URL, or a type with no aside renderer. Left alone entirely,
    // so a chapter link still navigates and an unsupported one behaves exactly
    // as it did before this wrapper existed — rather than opening an empty
    // panel over the page.
    if (!target || !ASIDE_TYPES.has(target.type)) return;

    /*
     * Both, and in this order.
     *
     * These anchors are `next/link`s, whose own handler calls `router.push()`
     * the moment it runs — so a handler that waits for the event to bubble up
     * here has already lost: `preventDefault` cannot undo a navigation that has
     * started. Stopping propagation during the capture phase is what keeps the
     * link's handler from running at all.
     */
    event.preventDefault();
    event.stopPropagation();

    open(
      asideKey(target.type, target.sourceId, target.slug),
      () => load(target.type, target.sourceId, target.slug),
      { label: anchor?.textContent?.trim() || undefined, push: nested },
    );
  };

  // A wrapper rather than a listener on `document`: the browse table's rows are
  // already `AsideLink`s and the top bar's links must keep navigating, so the
  // interception has to be scoped to the prose that wants it.
  //
  // Capture, not bubble — see the handler. The div takes no role and no
  // keyboard handler of its own: everything it catches is a click on a real
  // anchor, and a keyboard activation of that anchor arrives here as a click
  // too, so focus stays where it already was.
  return <div onClickCapture={onClick}>{children}</div>;
}
