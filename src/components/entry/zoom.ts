import { imageUrl, type ImageEntry } from "@/lib/content/media";

/**
 * What a printed image hands the viewer that opens it.
 *
 * Its own module because the two halves sit on opposite sides of the client
 * boundary: the page renders the button on the server, `ImageViewer` reads it
 * back in the browser, and a server component may not call a function that
 * lives in a `"use client"` file.
 */

/** Marks a link that should open in the viewer rather than navigate. */
export const ZOOM_ATTR = "data-zoom";
export const ZOOM_W = "data-zoom-w";
export const ZOOM_H = "data-zoom-h";
export const ZOOM_TITLE = "data-zoom-title";
export const ZOOM_ALT = "data-zoom-alt";

/**
 * The attributes an image's link carries.
 *
 * `href` is the full-size source rather than what the page is showing:
 * `next/image` serves the column a variant sized for the column, and opening
 * that would be opening the same small picture again.
 *
 * A real link, and that is the point of it. The viewer catches the click, but
 * until the script has loaded — a chapter can carry thirty images and this is
 * the last thing to hydrate — the map still opens, and a middle click still
 * puts it in its own tab, which is what anyone reading a map at a table wants
 * anyway.
 *
 * Undefined for an image the data gives no path for. There is nothing to open,
 * and the caller leaves it a picture rather than a dead control.
 */
export function zoomAttrs(
  image: ImageEntry,
  fallbackAlt: string,
): Record<string, string> | undefined {
  const src = imageUrl(image.href);
  if (!src) return undefined;

  return {
    href: src,
    [ZOOM_ATTR]: "",
    [ZOOM_W]: String(image.width ?? 0),
    [ZOOM_H]: String(image.height ?? 0),
    [ZOOM_TITLE]: image.title ?? "",
    [ZOOM_ALT]: image.altText ?? image.title ?? fallbackAlt,
  };
}
