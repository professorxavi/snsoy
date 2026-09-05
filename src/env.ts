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
   * The password `docker-compose.yml` initialises Postgres with.
   *
   * It is deliberately the same secret as the one inside `DATABASE_URL`, in two
   * places, because the two are read by different things: Compose cannot parse
   * a connection string, and Drizzle Kit, `psql` and every other tool want the
   * string rather than its parts. Composing `DATABASE_URL` from components was
   * the alternative and it trades that compatibility for nothing.
   *
   * What makes the duplication safe is `assertPasswordsAgree` below. Optional
   * because only a machine running the container needs it — a deployment
   * pointed at a database it did not start has no use for the value.
   */
  POSTGRES_PASSWORD: optional(z.string().min(1)),

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

/**
 * The two copies of the database password must be the same password.
 *
 * They drift in one specific way, and it is a bad one: `POSTGRES_PASSWORD` only
 * takes effect when the data volume is empty, so changing it against a database
 * that already exists silently does nothing. Everything keeps working on the old
 * credential, the two values disagree, and the mistake surfaces later on a fresh
 * machine — where the container initialises with the new password and the app
 * connects with the old one.
 *
 * Checked here rather than left to a connection error because the connection
 * error says `password authentication failed`, which reads as "wrong password"
 * and sends you looking in the wrong place.
 *
 * Only when both are present. A deployment that connects to a database it does
 * not manage sets `DATABASE_URL` alone, and that is not a misconfiguration.
 */
function assertPasswordsAgree(env: z.infer<typeof schema>): void {
  if (!env.POSTGRES_PASSWORD) return;

  const inUrl = new URL(env.DATABASE_URL).password;
  if (!inUrl || decodeURIComponent(inUrl) === env.POSTGRES_PASSWORD) return;

  throw new Error(
    "Invalid environment configuration:\n" +
      "  POSTGRES_PASSWORD does not match the password inside DATABASE_URL.\n\n" +
      "Compose initialises the database with the first and the app connects with\n" +
      "the second, so they have to be the same string. Note that changing\n" +
      "POSTGRES_PASSWORD does nothing to a volume that already exists — see the\n" +
      "rebuild sequence in .env.example.",
  );
}

assertPasswordsAgree(parsed.data);

export const env = parsed.data;
