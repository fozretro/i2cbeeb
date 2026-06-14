import { defineConfig } from "vitest/config";

const frameworkTests = ["src/**/*.test.ts"];
const configureTests = ["../../src/tests/vitest/configure/**/*.test.ts"];
const standaloneTests = [
  "../../src/tests/vitest/standalone/**/*.test.ts",
  ...configureTests,
];
const compositeTests = [
  "../../src/tests/vitest/fixtures/ap6/**/*.test.ts",
  ...configureTests,
];
const classicTests = ["../../src/tests/vitest/fixtures/ap6-classic/**/*.test.ts"];

const shared = {
  globals: true,
  testTimeout: 30_000,
  server: {
    deps: {
      inline: ["jsbeeb"],
    },
  },
};

/** Vitest projects — folder layout selects fixture; see src/tests/vitest/README.md */
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "standalone",
          include: [...standaloneTests, ...frameworkTests],
          ...shared,
        },
      },
      {
        extends: true,
        test: {
          name: "composite",
          include: [...compositeTests, ...frameworkTests],
          env: {
            I2CBEEB_TEST_COMPOSITE: "only",
          },
          ...shared,
        },
      },
      {
        extends: true,
        test: {
          name: "classic-composite",
          include: [...standaloneTests, ...classicTests, ...frameworkTests],
          ...shared,
        },
      },
      {
        extends: true,
        test: {
          name: "classic-only",
          include: classicTests,
          ...shared,
        },
      },
    ],
  },
});
