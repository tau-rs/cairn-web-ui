import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

// ESLint 9+ flat config (replaces the legacy .eslintrc.cjs). Mirrors the
// engine UI repo's setup, adapted to this project (no generated src/types;
// the vitest setup file is src/vitest.setup.ts).
export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "playwright-report",
      "test-results",
      ".stryker-tmp",
      "reports",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Classic react-hooks rules (parity with the previous .eslintrc setup).
      // eslint-plugin-react-hooks@7's "recommended" now also bundles the new
      // React-Compiler rules (refs/immutability/set-state-in-effect); adopting
      // those is a separate decision (they flag existing working code), so they
      // are intentionally not enabled in this config-format migration.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  // Tests, e2e, the vitest setup file, and root config files are not subject
  // to the react-refresh component-export rule.
  {
    files: [
      "**/*.test.{ts,tsx}",
      "e2e/**",
      "src/vitest.setup.ts",
      "*.config.{ts,js}",
    ],
    rules: { "react-refresh/only-export-components": "off" },
  },
  prettier,
);
