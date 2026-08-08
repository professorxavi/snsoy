/**
 * Where images live.
 *
 * The corpus never stores an absolute image URL. Every reference is a path
 * relative to a media root — `covers/PHB.webp`, `bestiary/MM/Aarakocra.webp` —
 * and the root is supplied at display time. That indirection is the whole
 * reason images can sit anywhere: a local checkout in development, object
 * storage in production, chosen by one variable rather than a code path.
 *
 * Three mechanisms produce a path, and only the third is guesswork:
 *
 * 1. An explicit path on the entity — a book's `cover`.
 * 2. An explicit path in prose or fluff — `{type: "image", href: {...}}`.
 * 3. A convention, for tokens — the entity carries only `hasToken: true` and
 *    the path is derived from its name and source. See `tokenPath`.
 */

/**
 * Prefix for every media path.
 *
 * `NEXT_PUBLIC_` because it is inlined at build time and is needed wherever an
 * image renders, server or client. Falling back to the local route keeps a
 * fresh checkout working with no configuration beyond `CONTENT_IMAGE_DIR`.
 */
const BASE = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || "/api/media/";

/** Join base and path without doubling or dropping the separator. */
export function mediaUrl(path: string): string {
  return `${BASE.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * The corpus's own filename rule for tokens: fold accents to ASCII, drop double
 * quotes, keep everything else — including spaces, which stay literal in the
 * path and are encoded per-segment on the way out.
 *
 * Ligatures need their own pass. NFD decomposes accented letters into a base
 * plus a combining mark, but `æ` is a single codepoint with no decomposition,
 * so stripping marks leaves it intact. Verified against the image set: this is
 * the difference between `Morgaen.webp` and a 404 on the one monster whose name
 * contains one.
 *
 * The accent range is pinned to U+0300–U+036F rather than all of `\p{Mn}` to
 * match the rule that generated the filenames — a broader class would strip
 * marks the upstream naming keeps.
 */
function toTokenName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/Æ/g, "AE")
    .replace(/æ/g, "ae")
    .replace(/"/g, "");
}

/** Media subdirectory per entity type. Tokens are filed separately by kind. */
export const TOKEN_DIRS = {
  monster: "bestiary/tokens",
  object: "objects/tokens",
  vehicle: "vehicles/tokens",
} as const;

export type TokenKind = keyof typeof TOKEN_DIRS;

/**
 * Conventional token path for an entity that only claims `hasToken`.
 *
 * Derived, not stored — nothing in the data records this path, so a token that
 * does not exist upstream yields a URL that 404s. An explicit `token` or
 * `tokenHref` on the entity overrides the convention and should be preferred
 * by the caller when present.
 */
export function tokenPath(
  kind: TokenKind,
  name: string,
  source: string,
): string {
  return `${TOKEN_DIRS[kind]}/${source}/${toTokenName(name)}.webp`;
}

/** An image entry as the corpus writes it, inline in prose or in fluff. */
export interface ImageHref {
  type?: string;
  path?: string;
  url?: string;
}

export interface ImageEntry {
  type: "image";
  href?: ImageHref;
  title?: string;
  altText?: string;
  credit?: string;
  width?: number;
  height?: number;
}

/**
 * Resolve an image entry to a URL.
 *
 * `internal` paths are relative to the media root; `external` ones carry an
 * absolute `url` and are returned untouched. Measured across every book and
 * adventure body: 6,701 image entries, all internal, zero external — but the
 * shape allows both and costs one branch to honour.
 */
export function imageUrl(href: ImageHref | undefined): string | null {
  if (!href) return null;
  if (href.type === "external") return href.url ?? null;
  return href.path ? mediaUrl(href.path) : null;
}

export function isImageEntry(value: unknown): value is ImageEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "image"
  );
}
