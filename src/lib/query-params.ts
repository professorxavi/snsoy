/**
 * Filter state, held in the URL.
 *
 * Every filter on a browse view is a query parameter and nothing else — there
 * is no component state mirroring it. That is what makes a filtered list
 * linkable, back-and-forward correct, and shareable: "here are the 2nd-level
 * concentration spells a bard can cast" is a URL someone can paste into chat
 * mid-session, which is when people actually need it.
 *
 * Values are comma-separated rather than repeated (`?level=3,4`, not
 * `?level=3&level=4`) so the URL stays short enough to read.
 */

export type QueryParams = Record<string, string | string[] | undefined>;

/** First value only — a repeated param is a malformed URL, not a list. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readList(params: QueryParams, key: string): string[] {
  const raw = first(params[key]);
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function readNumberList(params: QueryParams, key: string): number[] {
  return readList(params, key)
    .map(Number)
    .filter((value) => Number.isInteger(value));
}

export function readString(params: QueryParams, key: string): string | undefined {
  const raw = first(params[key])?.trim();
  return raw || undefined;
}

/** Absent means "no opinion", which is different from explicitly false. */
export function readBoolean(
  params: QueryParams,
  key: string,
): boolean | undefined {
  const raw = first(params[key]);
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return undefined;
}

export function readPage(params: QueryParams): number {
  const raw = Number(first(params["page"]));
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

function toSearchParams(params: QueryParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = first(value);
    if (single) search.set(key, single);
  }
  return search;
}

/**
 * Serialise back to a query string.
 *
 * Keys are sorted so the same filter state always produces the same URL —
 * otherwise two identical views would be two different cache entries and two
 * different history entries.
 */
function stringify(search: URLSearchParams): string {
  search.sort();
  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * Add or remove one value from a multi-value filter.
 *
 * Paging is reset on every filter change: page 7 of an unfiltered list is
 * almost never a meaningful page 7 once a filter narrows it to twelve results.
 */
export function toggleValue(
  params: QueryParams,
  key: string,
  value: string,
): string {
  const current = readList(params, key);
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];

  const search = toSearchParams(params);
  if (next.length > 0) search.set(key, next.join(","));
  else search.delete(key);
  search.delete("page");

  return stringify(search);
}

/** Set or clear a single-valued parameter. */
export function withValue(
  params: QueryParams,
  key: string,
  value: string | undefined,
): string {
  const search = toSearchParams(params);
  if (value) search.set(key, value);
  else search.delete(key);
  if (key !== "page") search.delete("page");

  return stringify(search);
}

/** Flip a tri-state flag: off -> on -> off. */
export function toggleFlag(params: QueryParams, key: string): string {
  const current = readBoolean(params, key);
  return withValue(params, key, current === true ? undefined : "1");
}

export function clearAll(params: QueryParams, keep: string[] = []): string {
  const search = new URLSearchParams();
  for (const key of keep) {
    const value = first(params[key]);
    if (value) search.set(key, value);
  }
  return stringify(search);
}

/** True when any filter is set — page and sort are not filters. */
export function hasFilters(params: QueryParams, keys: string[]): boolean {
  return keys.some((key) => Boolean(first(params[key])));
}
