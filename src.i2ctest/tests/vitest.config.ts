import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000,
    include: ["./**/*.test.ts"],
    server: {
      deps: {
        inline: ["jsbeeb"],
      },
    },
  },
  resolve: {
    alias: {
      "@i2cbeeb-unittest": resolve(__dirname, "../../bin/rom-unittest/src"),
    },
  },
  server: {
    fs: {
      allow: [resolve(__dirname, "../..")],
    },
  },
});
