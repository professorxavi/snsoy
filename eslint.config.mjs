import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The browser tests build into their own directory so they can run beside
    // a dev server; it is build output all the same.
    ".next-e2e/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
