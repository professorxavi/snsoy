import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { ReadableOptions } from "node:stream";
import { env } from "@/env";

/**
 * Serves images off local disk in development. In production
 * `NEXT_PUBLIC_IMAGE_BASE_URL` points at object storage and this route never
 * runs, so the several-gigabyte image set is never bundled or deployed.
 *
 * Disabled unless `CONTENT_IMAGE_DIR` is set.
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

  // Next decodes catch-all segments, so `..` can arrive intact. Resolve first,
  // then check containment — pattern-matching the raw input can be defeated by
  // encoding, symlinks or Windows separators.
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
        // Immutable in practice: images never change in place.
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
