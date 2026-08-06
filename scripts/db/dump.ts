import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CONTENT_TABLES, CONTAINER, DB_NAME, DB_USER } from "./tables";

/**
 * Dumps the content tables to a seed file.
 *
 * Ingest runs once, ever. After the loaded data is verified, this produces the
 * artefact every future instance is built from — the database is populated by
 * restoring a seed, never by re-parsing the corpus.
 *
 *   pnpm db:dump                        -> seed/content.sql
 *   pnpm db:dump seed/content-srd.sql
 *
 * Runs `pg_dump` inside the Postgres container, so no local client install is
 * needed and the dump always matches the server version.
 */

function main(): number {
  const target = resolve(process.argv[2] ?? "seed/content.sql");
  mkdirSync(dirname(target), { recursive: true });

  console.log(`dumping ${CONTENT_TABLES.length} content tables -> ${target}`);

  const result = spawnSync(
    "docker",
    [
      "exec",
      CONTAINER,
      "pg_dump",
      "-U",
      DB_USER,
      "-d",
      DB_NAME,
      // Data only: the schema comes from migrations, so a seed carrying DDL
      // would silently drift from the Drizzle definitions.
      "--data-only",
      "--no-owner",
      "--no-privileges",
      // Load rows without re-checking foreign keys, which would otherwise fail
      // on tables dumped before the ones they reference.
      "--disable-triggers",
      ...CONTENT_TABLES.flatMap((table) => ["-t", `public.${table}`]),
    ],
    { encoding: "buffer", maxBuffer: 2 * 1024 * 1024 * 1024 },
  );

  if (result.status !== 0) {
    console.error(result.stderr?.toString() || "pg_dump failed");
    return result.status ?? 1;
  }

  writeFileSync(target, result.stdout);

  console.log(`wrote ${(statSync(target).size / 1024 / 1024).toFixed(1)} MB`);
  return 0;
}

process.exit(main());
