import "dotenv/config";
import { z } from "zod";

/**
 * Server-side environment. Importing this from a client component is a bug —
 * these values must never reach the browser bundle.
 */
/**
 * Treat an empty variable as absent. `.env.example` ships every optional key
 * as `""`, and copying it verbatim should not fail validation.
 */
const optional = <T extends z.ZodType>(inner: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), inner.optional());

const schema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  /**
   * Absolute path to the source JSON data directory. Only needed for ingestion
   * — a deployed instance reads from the database. The ingest CLI asserts it.
   */
  CONTENT_SOURCE_DIR: optional(z.string().min(1)),

  /**
   * Absolute path to the source image directory, served in development by
   * `/api/media`. Production uses `NEXT_PUBLIC_IMAGE_BASE_URL` instead.
   */
  CONTENT_IMAGE_DIR: optional(z.string().min(1)),

  /**
   * Origin every relative media path is resolved against. Unset falls back to
   * the local `/api/media/` route; in production this is the bucket's origin.
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
