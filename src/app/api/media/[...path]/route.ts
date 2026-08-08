import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { ReadableOptions } from "node:stream";
import { env } from "@/env";

/**
 * Serves corpus images off local disk, for development only.
 *
 * Production points `NEXT_PUBLIC_IMAGE_BASE_URL` at object storage and this
 * route never runs — which is the point. The image set is several gigabytes,
 * so it is not committed, not bundled, and not copied into a deployment; it is
 * a directory the developer clones wherever they like and names in `.env`.
 *
 * Disabled unless `CONTENT_IMAGE_DIR` is set, so an instance that forgets to
 * configure a CDN serves nothing rather than silently serving from the
 * filesystem it happens to be running on.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const root = env.CONTENT_IMAGE_DIR;
  if (!root) {
    return new Response("CONTENT_IMAGE_DIR is not set.", { status: 404 });
  }

  const { path } = await params;

  /*
   * Containment check, not a sanitising pass.
   *
   * Next already decodes the catch-all segments, so `..` can arrive intact.
   * Resolving first and then proving the result is still under the root is the
   * only form of this check that cannot be tricked by encoding, symlinks or
   * Windows path separators — pattern-matching the input cannot make that
   * guarantee.
   */
  const rootDir = resolve(root);
  const target = resolve(join(rootDir, ...path));
  if (target !== rootDir && !target.startsWith(rootDir + sep)) {
    return new Response("Not found.", { status: 404 });
  }

  let size: number;
  try {
    const info = await stat(target);
    if (!info.isFile()) return new Response("Not found.", { status: 404 });
    size = info.size;
  } catch {
    return new Response("Not found.", { status: 404 });
  }

  const stream = createReadStream(target) as unknown as {
    [Symbol.asyncIterator](options?: ReadableOptions): AsyncIterableIterator<
      Uint8Array
    >;
  };

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) controller.enqueue(chunk);
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    }),
    {
      headers: {
        "Content-Type":
          CONTENT_TYPES[extname(target).toLowerCase()] ??
          "application/octet-stream",
        "Content-Length": String(size),
        // Immutable in practice: the corpus images never change in place.
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
