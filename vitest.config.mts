import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    // `tests/smoke` holds the checks that need a running instance; everything
    // else sits next to the module it covers.
    include: [
      "src/**/*.test.ts",
      "scripts/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    // Corpus integration tests parse ~14 MB of bestiary JSON; 5s is tight.
    testTimeout: 30_000,
    // Tests that need more than the repo — the corpus, the database, a running
    // server — read their address from the environment and skip without it.
    setupFiles: ["dotenv/config"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
