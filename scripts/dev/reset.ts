import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";

/**
 * Frees the dev port and clears the build cache, before `next dev` starts.
 *
 * Two things conspire to leave dev servers running on Windows. Killing a shell
 * does not take down the grandchild that actually owns the port, and Next never
 * fails on a busy port — it warns and moves to the next one. Four restarts
 * leave four live servers on 3000-3003, with no error anywhere to say so.
 *
 * So this kills every dev server belonging to this project, whichever port it
 * drifted onto, then deletes .next — a stale cache is the usual reason for the
 * restart in the first place.
 *
 *   pnpm dev                     -> frees 3000, wipes .next
 *   KEEP_NEXT_CACHE=1 pnpm dev   -> frees 3000, keeps .next
 */

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 3000);
const ROOT = process.cwd();

type NodeProcess = {
  ProcessId: number;
  ParentProcessId: number;
  CommandLine: string | null;
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Every running node process, with the parent links needed to walk a chain. */
function nodeProcesses(): NodeProcess[] {
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      // Single quotes only: the whole script is one argument, so embedded
      // double quotes would have to survive two levels of Windows escaping.
      "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' }" +
        " | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress",
    ],
    { encoding: "utf8" },
  );

  const output = result.stdout?.trim();
  if (!output) return [];

  // ConvertTo-Json emits a bare object rather than an array for a single match.
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

/** PIDs holding a listening socket on `port`, whoever they belong to. */
function listenersOn(port: number): number[] {
  const result = spawnSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
  const found = new Set<number>();

  for (const line of (result.stdout ?? "").split("\n")) {
    const [, local, , state, pid] = line.trim().split(/\s+/);
    if (state !== "LISTENING") continue;
    // Matches both 0.0.0.0:3000 and [::]:3000, but not a client port 13000.
    if (!local?.endsWith(`:${port}`)) continue;
    found.add(Number(pid));
  }

  return [...found];
}

/**
 * A dev server for this project: `next dev` in some form, under this directory.
 *
 * The port owner is `start-server.js` and carries no "dev" in its command line,
 * so it is only ever reached through the port or as a child of a match.
 */
function isProjectDevServer(proc: NodeProcess): boolean {
  const command = proc.CommandLine?.toLowerCase();
  if (!command) return false;
  return (
    command.includes(ROOT.toLowerCase()) && command.includes("next") && /\bdev\b/.test(command)
  );
}

/** A wrapper process worth killing, but only as an ancestor of a real match. */
function isDevWrapper(proc: NodeProcess): boolean {
  const command = proc.CommandLine?.toLowerCase();
  if (!command) return false;
  return command.includes("next") && /\bdev\b/.test(command);
}

/**
 * Seeds plus their node ancestors, so the npx and `next` bin wrappers go too.
 *
 * The walk stops at the first process that is not itself part of a `next dev`
 * invocation, which keeps it from climbing into the terminal or editor that
 * launched the server.
 */
function withAncestors(seeds: number[], all: NodeProcess[]): Set<number> {
  const byPid = new Map(all.map((proc) => [proc.ProcessId, proc]));
  const doomed = new Set(seeds);

  for (const seed of seeds) {
    let parent = byPid.get(byPid.get(seed)?.ParentProcessId ?? -1);
    while (parent && !doomed.has(parent.ProcessId) && isDevWrapper(parent)) {
      doomed.add(parent.ProcessId);
      parent = byPid.get(parent.ParentProcessId);
    }
  }

  return doomed;
}

function kill(pids: number[]): void {
  // /T so anything spawned below a match dies with it, /F because a hung dev
  // server is exactly the case where a polite shutdown never lands.
  spawnSync("taskkill", ["/F", "/T", ...pids.flatMap((pid) => ["/PID", String(pid)])], {
    encoding: "utf8",
  });
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((done) => {
    const probe = createServer();
    probe.once("error", () => done(false));
    probe.once("listening", () => probe.close(() => done(true)));
    probe.listen(port);
  });
}

async function freePort(): Promise<void> {
  const all = nodeProcesses();
  const byPid = new Map(all.map((proc) => [proc.ProcessId, proc]));

  const listeners = listenersOn(PORT);
  const ours = all.filter(isProjectDevServer).map((proc) => proc.ProcessId);
  const seeds = [...new Set([...ours, ...listeners.filter((pid) => byPid.has(pid))])];

  const foreign = listeners.filter((pid) => !byPid.has(pid));
  if (foreign.length > 0) {
    console.warn(
      `warning: port ${PORT} is held by non-node process ${foreign.join(", ")} — ` +
        `leaving it alone, so Next will start on another port`,
    );
  }

  if (seeds.length === 0) return;

  const doomed = [...withAncestors(seeds, all)];
  console.log(`killing ${doomed.length} stale dev process(es): ${doomed.join(", ")}`);
  kill(doomed);

  // Killing is asynchronous, and the listening socket outlives the process by a
  // moment. Starting Next before it clears would just land on the next port up.
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await isPortFree(PORT)) return;
    await sleep(100);
  }

  console.warn(`warning: port ${PORT} still busy after killing ${doomed.length} process(es)`);
}

async function clearCache(): Promise<void> {
  if (process.env.KEEP_NEXT_CACHE) return;

  const target = resolve(ROOT, ".next");

  // Windows can hold directory handles briefly after the owning process dies.
  for (let attempt = 0; ; attempt++) {
    try {
      rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt >= 5) throw error;
      await sleep(100);
    }
  }
}

async function main(): Promise<number> {
  if (process.platform !== "win32") {
    // Other platforms kill the process group, so servers do not survive a
    // restart there and only the cache is worth clearing.
    await clearCache();
    return 0;
  }

  await freePort();
  await clearCache();
  return 0;
}

main().then((code) => process.exit(code));
