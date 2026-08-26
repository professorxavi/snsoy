import { normalizeQuery } from "@/lib/content/search";
import { suggestEntities, type Suggestion } from "@/server/db/queries/search";

/**
 * The typeahead's data source.
 *
 * A route handler returning JSON rather than a server function returning JSX,
 * which is what every other panel in this app uses. Two reasons, and the second
 * is the deciding one:
 *
 * - A suggestion is eight words and a URL. There is no markup to send, so the
 *   RSC payload's whole advantage — shipping a rendered tree without shipping
 *   the components — buys nothing here, and JSON is a tenth the size on a
 *   request that fires every 150ms while someone types.
 * - The caller is a client component in the top bar. Importing a server
 *   function there leaves its modules out of the client manifest and breaks in
 *   `next dev` only; a `fetch` to a URL has no such coupling. The existing
 *   actions dodge this by being bound in a server component and passed down as
 *   props, which the top bar cannot do — it is on every page, and none of them
 *   know anything about search.
 *
 * The query is normalised with the same function the results page uses, so a
 * string too short to answer is refused identically in both places rather than
 * turning into a scan of every name in the books.
 */

export interface SuggestResponse {
  /** The normalised query, echoed so the client can drop a stale reply. */
  q: string;
  suggestions: Suggestion[];
}

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("q") ?? undefined;
  const q = normalizeQuery(raw);

  if (!q) {
    return Response.json({ q: "", suggestions: [] } satisfies SuggestResponse);
  }

  const suggestions = await suggestEntities(q);

  return Response.json({ q, suggestions } satisfies SuggestResponse, {
    /*
     * The books do not change between deployments, so the same query always
     * has the same answer and a repeated keystroke — backspacing over a word
     * and retyping it — should not reach the database twice. Private, because
     * entitlement gating will eventually make this per-reader.
     */
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
