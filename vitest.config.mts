import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // Corpus integration tests parse ~14 MB of bestiary JSON; 5s is tight.
    testTimeout: 30_000,
    // Corpus tests read CONTENT_SOURCE_DIR and skip themselves without it.
    setupFiles: ["dotenv/config"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
