import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Two projects, split by what they need to run in.
 *
 * The unit project is the bulk of the suite and stays in Node: parsers,
 * resolvers, query shaping, and the smoke tests, which talk to a server or a
 * database over the wire and never touch a DOM. Keeping it in Node is what
 * holds that run under a second.
 *
 * The component project pays for jsdom, so only the tests that render React
 * live there. The split is by extension rather than by directory — a component
 * test sits next to the component it covers, same as every other test here.
 */

const resolve = {
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
};

const shared = {
  // Corpus integration tests parse ~14 MB of bestiary JSON; 5s is tight.
  testTimeout: 30_000,
  // Tests that need more than the repo — the corpus, the database, a running
  // server — read their address from the environment and skip without it.
  setupFiles: ["dotenv/config"],
};

export default defineConfig({
  resolve,
  test: {
    projects: [
      {
        resolve,
        test: {
          ...shared,
          name: "unit",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "scripts/**/*.test.ts",
            "tests/**/*.test.ts",
          ],
        },
      },
      {
        resolve,
        test: {
          ...shared,
          name: "components",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: [...shared.setupFiles, "./src/test/setup.ts"],
        },
      },
    ],
  },
});
