/// <reference types="vitest/config" />
import { reactRouter } from "@react-router/dev/vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
const dirname =
  typeof import.meta.dirname !== "undefined"
    ? import.meta.dirname
    : path.dirname(fileURLToPath(import.meta.url));

// Starting jsdom dominates unit-test time, so only tests that need a DOM pay
// for it: every `.test.tsx` file, plus the `.test.ts` files listed here. All
// other `.test.ts` files run in the `node` environment without a setup file.
const domTestsInTs = ["app/lib/legacyBrowserData.test.ts", "app/lib/persistentState.test.ts"];

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [vanillaExtractPlugin(), process.env.VITEST ? react() : reactRouter()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit-node",
          maxWorkers: 6,
          environment: "node",
          globals: true,
          include: ["app/**/*.test.ts", "scripts/**/*.test.mjs"],
          exclude: [...configDefaults.exclude, ...domTestsInTs],
        },
      },
      {
        extends: true,
        test: {
          name: "unit-dom",
          maxWorkers: 6,
          environment: "jsdom",
          globals: true,
          include: ["app/**/*.test.tsx", ...domTestsInTs],
          setupFiles: ["app/test-setup.ts"],
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          isolate: false,
          maxWorkers: 6,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
