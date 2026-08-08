import { defineConfig, devices } from "@playwright/test";

/**
 * The browser tier.
 *
 * Deliberately small. Almost everything worth asserting about this app is
 * answerable from server-rendered HTML, a rendered component or a query, and
 * all three run in Vitest in seconds. What is left here is the residue that a
 * real browser is the only way to see: computed layout, scroll position, the
 * intercepting aside, history, and whether the page hydrates at all.
 *
 * Tests are colocated as `*.e2e.ts`, next to the route they drive — the same
 * rule the Vitest projects follow, and the reason there is no test directory.
 * Vitest matches `*.test.ts`, so the two runners never pick up each other's
 * files.
 *
 *   pnpm e2e            run them
 *   pnpm e2e --ui       pick through them interactively
 */

/**
 * Its own port and its own build directory, so a browser run and a dev server
 * can coexist without either disturbing the other.
 */
const PORT = 3123;
const BASE_URL = `http://localhost:${PORT}`;
const DIST_DIR = ".next-e2e";

export default defineConfig({
  testDir: "./src",
  testMatch: "**/*.e2e.ts",

  // A dev server compiles routes on demand, so the first hit on a cold route
  // is slow in a way that has nothing to do with the assertion.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  /*
   * One worker. Next's dev server compiles per route on first request, and
   * several workers racing a cold server turn a slow compile into a timeout
   * that looks like a failure. There are few enough tests here that the wall
   * clock barely moves.
   */
  workers: 1,
  fullyParallel: false,

  reporter: process.env.CI ? "line" : "list",

  use: {
    baseURL: BASE_URL,
    /*
     * Wide enough for the `lg` breakpoint. The filter rail, the reading
     * outline and the aside are all behind it, and at a narrower viewport
     * every layout assertion below would be testing the mobile fallback
     * instead of the thing it names.
     */
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  /*
   * Builds and serves the app rather than driving `next dev`.
   *
   * This is not about speed. A dev server compiles routes on demand, and after
   * enough navigation it silently stops intercepting the parallel route the
   * spell aside is built on — clicks start navigating away instead of opening
   * in place. Nothing errors; the tests simply fail as though the feature had
   * been deleted, which is exactly the wrong signal from a suite whose job is
   * to notice when it really has been.
   *
   * A production build has no on-demand compilation and no such decay, and it
   * is what a deployment actually serves. `NEXT_DIST_DIR` keeps its output out
   * of `.next`, so this can run beside a dev server without corrupting it.
   */
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    env: { NEXT_DIST_DIR: DIST_DIR },
    url: BASE_URL,
    /*
     * Never adopt a server that happens to answer on this port. A stale one
     * left over from an earlier session will serve an old build quite happily,
     * and the suite then reports failures for code that is fine — which has
     * already cost more time here than every build this setting will ever run.
     */
    reuseExistingServer: false,
    // A cold build of the whole app, not just a server start.
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
