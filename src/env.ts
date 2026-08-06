import "dotenv/config";
import { z } from "zod";

/**
 * Server-side environment. Importing this from a client component is a bug —
 * these values must never reach the browser bundle.
 */
const schema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  /**
   * Absolute path to a corpus-format JSON data directory.
   *
   * Optional at runtime because the app only needs it during ingestion — a
   * deployed instance reads from the database, not from disk. The ingest CLI
   * asserts its presence itself so the failure lands where it makes sense.
   */
  CONTENT_SOURCE_DIR: z.string().min(1).optional(),

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
