import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["../../src/tests/vitest/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 30_000,
  },
  server: {
    deps: {
      inline: ["jsbeeb"],
    },
  },
});
