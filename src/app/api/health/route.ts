import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

/**
 * Whether this instance can actually serve a page.
 *
 * It answers by reaching the database, not by existing. The failures worth
 * catching here are the connection pool exhausted and the Postgres container
 * gone, and a process that only reports its own liveness is perfectly healthy
 * through both — it just returns errors to every reader. `client.ts` caps the
 * pool at 10 in production, so exhaustion is a state this can genuinely reach.
 *
 * The body carries a status and nothing else. No version, no row counts, no
 * message off the caught error: this is a public URL on a public site, and a
 * health check is a standing invitation to enumerate what is behind it.
 */

/** Long enough to absorb a slow query, short enough to fail before a monitor does. */
const PROBE_TIMEOUT_MS = 2_000;

/*
 * Never cached, and never prerendered. A build that baked this would ship a
 * permanent `ok`, and Cloudflare will cache a 200 from any origin unless told
 * otherwise — which matters here because the deployment puts an aggressive HTML
 * cache rule in front of exactly this server. A cached health check is worse
 * than no health check: it reports the state of a machine at build time forever.
 */
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

export async function GET(): Promise<Response> {
  try {
    await withTimeout(db.execute(sql`select 1`), PROBE_TIMEOUT_MS);
  } catch {
    return Response.json({ status: "degraded" }, { status: 503, headers: NO_STORE });
  }

  return Response.json({ status: "ok" }, { status: 200, headers: NO_STORE });
}

/**
 * A database that has stopped answering does not reject — it hangs, holding the
 * request open. Without this the health check fails in precisely the manner it
 * exists to detect: the monitor times out, and what it learns is that the check
 * is unreachable rather than that the database is.
 */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("health probe timed out")), ms);
  });

  return Promise.race([work, expiry]).finally(() => clearTimeout(timer)) as Promise<T>;
}
