import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * Next.js dev mode re-evaluates modules on every hot reload. Without a global
 * cache each reload opens a fresh pool and the old one leaks connections until
 * Postgres refuses new ones.
 */
const globalForDb = globalThis as unknown as {
  snsoyClient?: postgres.Sql;
};

const client =
  globalForDb.snsoyClient ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 10 : 5,
  });

if (env.NODE_ENV !== "production") globalForDb.snsoyClient = client;

export const db = drizzle(client, { schema, casing: "snake_case" });

export type Db = typeof db;
