import { defineConfig } from "vitest/config";

/** Full Vitest suite including the AP6 composite fixture (#29). */
export default defineConfig({
  test: {
    globals: true,
    include: ["../../src/tests/vitest/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 30_000,
    env: {
      I2CBEEB_TEST_COMPOSITE: "only",
    },
  },
  server: {
    deps: {
      inline: ["jsbeeb"],
    },
  },
});
