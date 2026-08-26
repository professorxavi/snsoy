import { isImplemented } from "./compendium-directory";
import {
  hasDetailPage,
  listHrefFor,
  parseEntityHref,
  segmentFor,
} from "./routes";

/**
 * What a 404'd address was reaching for, when it was reaching for anything.
 *
 * Most of this app's entities have no page. `hrefFor` addresses all of them
 * anyway — a creature link in book text is a real anchor, because an anchor is
 * what a reader can middle-click, and taking that away to avoid a dead end
 * would cost more than the dead end does. So the same URL that opens a panel in
 * place is also a URL that resolves to nothing when it is opened cold.
 *
 * That makes most 404s here well-formed rather than wrong, and this is what
 * tells the two apart: given the path, name what was asked for and where it
 * does open. A mistyped or invented URL yields null and gets the plain page.
 *
 * "Most", not all: four types do have a page — see `hasDetailPage`. A 404 on
 * one of those is an ordinary typo, and gets nothing.
 */

export interface DeadEnd {
  /** What the address named, plural and title-cased: "Monsters". */
  label: string;
  /** The list they open beside, or null when the type has no list either. */
  listHref: string | null;
}

/**
 * Read a dead compendium address.
 *
 * Only the four-segment entity shape counts — `/compendium/conditions/phb/prone`,
 * the shape a middle-click produces. A bad list URL is a typo rather than a
 * road we chose not to pave, and gets nothing.
 */
export function readDeadEnd(pathname: string): DeadEnd | null {
  const parsed = parseEntityHref(pathname);
  if (!parsed) return null;

  /*
   * A type with a page of its own has no explaining to do. This address was
   * supposed to resolve, so landing here means the slug was wrong — a typo,
   * which gets the plain page. Saying "Spells have no page of their own" to
   * someone who mistyped a spell would be false in both halves, and the
   * confident tone makes it worse than silence.
   */
  if (hasDetailPage(parsed.type)) return null;

  const segment = segmentFor(parsed.type);
  if (!segment) return null;

  return {
    label: labelFor(segment),
    // Four types have no browse view at all, so there is nowhere to send them
    // but the index — see `WITHOUT_A_BROWSE_VIEW`.
    listHref: isImplemented(parsed.type) ? listHrefFor(parsed.type) : null,
  };
}

/**
 * The segment is the label, near enough: it is already plural and already
 * word-separated, which is what makes a map of 32 display names unnecessary.
 */
function labelFor(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
