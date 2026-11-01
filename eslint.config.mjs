import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

import { importBoundaryRule } from "./tooling/eslint/import-boundaries.mjs";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  globalIgnores([".next/**", "out/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"]),
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { cookly: { rules: { "import-boundaries": importBoundaryRule } } },
    rules: {
      "cookly/import-boundaries": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-properties": ["error", { object: "process", property: "env", message: "Read environment through src/config/env adapters." }],
    },
  },
  {
    files: ["src/config/env/**/*.{ts,tsx}"],
    rules: { "no-restricted-properties": "off" },
  },
]);
