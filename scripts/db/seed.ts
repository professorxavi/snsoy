import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { CONTENT_TABLES, CONTAINER, DB_NAME, DB_USER } from "./tables";

/**
 * Restores a content seed into the database.
 *
 * This is how an instance gets its content — the normal path, and after the
 * one-time ingest, the only path.
 *
 *   pnpm db:seed                        <- seed/content.sql
 *   pnpm db:seed seed/content-srd.sql
 *
 * Expects migrations to have been applied already: the seed carries data, not
 * schema, so that the shipped tables can never drift from the Drizzle
 * definitions.
 */

/**
 * Pipe SQL into psql inside the container.
 *
 * Input is a Buffer rather than a string: the seed is tens of megabytes, and
 * decoding it to a JS string only to re-encode it is wasted work.
 */
function psql(sql: string | Buffer): { status: number; stderr: string } {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      CONTAINER,
      "psql",
      "-U",
      DB_USER,
      "-d",
      DB_NAME,
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: typeof sql === "string" ? Buffer.from(sql, "utf8") : sql,
      maxBuffer: 2 * 1024 * 1024 * 1024,
    },
  );
  return {
    status: result.status ?? 1,
    stderr: result.stderr?.toString() ?? "",
  };
}

function main(): number {
  const file = resolve(process.argv[2] ?? "seed/content.sql");

  if (!existsSync(file)) {
    console.error(
      `Seed file not found: ${file}\n\n` +
        "Either check out a seed, or build one:\n" +
        "  pnpm ingest && pnpm db:dump",
    );
    return 1;
  }

  // The tables must exist before data can land in them.
  const check = psql("SELECT 1 FROM entities LIMIT 1;");
  if (check.status !== 0 && /does not exist/i.test(check.stderr)) {
    console.error("Schema is missing. Run `pnpm db:migrate` first.");
    return 1;
  }

  console.log(
    `restoring ${(statSync(file).size / 1024 / 1024).toFixed(1)} MB from ${file}`,
  );

  // Clear existing content first so seeding is repeatable. Truncating
  // `sources` cascades through the whole content graph; user tables are not
  // listed and are left untouched.
  const clear = psql(
    `TRUNCATE TABLE ${CONTENT_TABLES.map((t) => `public.${t}`).join(", ")} RESTART IDENTITY CASCADE;`,
  );
  if (clear.status !== 0) {
    console.error(clear.stderr || "failed to clear existing content");
    return clear.status;
  }

  const restore = psql(readFileSync(file));
  if (restore.status !== 0) {
    console.error(restore.stderr || "restore failed");
    return restore.status;
  }

  const counts = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      CONTAINER,
      "psql",
      "-U",
      DB_USER,
      "-d",
      DB_NAME,
      "-tAc",
      "SELECT (SELECT count(*) FROM sources) || ' sources, ' || " +
        "(SELECT count(*) FROM entities) || ' entities, ' || " +
        "(SELECT count(*) FROM entity_links) || ' links'",
    ],
    { encoding: "utf8" },
  );

  console.log(`restored: ${counts.stdout.trim()}`);
  return 0;
}

process.exit(main());
