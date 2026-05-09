import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config for Triage.
 *
 * Mirrors tsconfig.json's "@/*" -> "./*" path alias so the invariant
 * suite (tests/invariants/*) and fixture round-trip tests can import
 * from `@/lib/types`, `@/lib/hyperspell/client`, etc.
 *
 * Tests live alongside source under `tests/`. The `seed/billing-service`
 * tree is excluded (it's a synthetic Git repo, not TS source) and so is
 * `convex/_generated` (Convex codegen).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      "convex/_generated/**",
      "seed/billing-service/**",
      ".next/**",
    ],
    environment: "node",
  },
});
