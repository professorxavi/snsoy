/**
 * Image URL construction.
 *
 * The source data stores image paths relative to a media root
 * (`covers/PHB.webp`), never absolute URLs, so the root can be swapped between
 * a local directory and object storage with one env var.
 *
 * A path comes from an explicit field on the entity, an explicit `{type:
 * "image"}` entry in prose, or — for tokens only — is derived by convention
 * from the entity's name and source. See `tokenPath`.
 */

/**
 * Prefix for every media path. `NEXT_PUBLIC_` because images render on both
 * server and client.
 */
const BASE = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || "/api/media/";

/** Join base and path without doubling or dropping the separator. */
export function mediaUrl(path: string): string {
  return `${BASE.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * Mirrors the upstream filename rule for tokens: fold accents to ASCII, drop
 * double quotes, keep spaces literal.
 *
 * Ligatures need the explicit pass because `æ` is a single codepoint with no
 * NFD decomposition, so stripping combining marks leaves it intact. The accent
 * range is pinned to U+0300–U+036F rather than all of `\p{Mn}` because a
 * broader class strips marks the upstream filenames keep.
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
 * Conventional token path for an entity that only sets `hasToken`. Derived
 * rather than stored, so a token missing upstream yields a URL that 404s.
 * Callers should prefer an explicit `token`/`tokenHref` when the entity has one.
 */
export function tokenPath(
  kind: TokenKind,
  name: string,
  source: string,
): string {
  return `${TOKEN_DIRS[kind]}/${source}/${toTokenName(name)}.webp`;
}

/** An image entry as the source data writes it, inline in prose or in fluff. */
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
 * Resolve an image entry to a URL. `internal` paths are relative to the media
 * root; `external` ones carry an absolute `url` and pass through untouched.
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
