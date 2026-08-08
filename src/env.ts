import "dotenv/config";
import { z } from "zod";

/**
 * Server-side environment. Importing this from a client component is a bug —
 * these values must never reach the browser bundle.
 */
/**
 * Treat an empty variable as an absent one.
 *
 * `.env.example` ships every optional key with `""` so the file documents the
 * full surface. Copying it verbatim is the expected first step, and without
 * this an empty placeholder would fail validation and refuse to boot — the
 * opposite of what a blank default should do.
 */
const optional = <T extends z.ZodType>(inner: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), inner.optional());

const schema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  /**
   * Absolute path to a corpus-format JSON data directory.
   *
   * Optional at runtime because the app only needs it during ingestion — a
   * deployed instance reads from the database, not from disk. The ingest CLI
   * asserts its presence itself so the failure lands where it makes sense.
   */
  CONTENT_SOURCE_DIR: optional(z.string().min(1)),

  /**
   * Absolute path to a directory of corpus-format images, served in
   * development by `/api/media`.
   *
   * Development only, and optional even there. Production sets
   * `NEXT_PUBLIC_IMAGE_BASE_URL` to an object-storage origin instead and never
   * touches the filesystem — 4+ GB of images has no business in a deployment.
   */
  CONTENT_IMAGE_DIR: optional(z.string().min(1)),

  /**
   * Origin every relative media path is resolved against.
   *
   * Unset falls back to `/api/media/`, the local-disk route, so a fresh
   * checkout works with only `CONTENT_IMAGE_DIR` set. In production this is
   * the bucket's public origin and the local route stays dormant.
   */
  NEXT_PUBLIC_IMAGE_BASE_URL: optional(z.url()),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = z.flattenError(parsed.error).fieldErrors;
  const detail = Object.entries(issues)
    .map(([key, messages]) => `  ${key}: ${messages?.join(", ")}`)
    .join("\n");

  throw new Error(
    `Invalid environment configuration:\n${detail}\n\nCopy .env.example to .env and fill in the blanks.`,
  );
}

export const env = parsed.data;
