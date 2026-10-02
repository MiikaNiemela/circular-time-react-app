/**
 * Builds the command-line jobs in `app/jobs/` into `build/jobs/`.
 *
 * Jobs run in the same image as the server, with Node and the production
 * dependencies; packages stay external and are resolved from `node_modules`.
 * `VITE_*` variables are inlined at build time, as in the server build.
 */
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    ssr: true,
    outDir: "build/jobs",
    emptyOutDir: true,
    target: "node24",
    rollupOptions: {
      input: { "refresh-calendars": "app/jobs/refresh-calendars.ts" },
      output: { format: "es", entryFileNames: "[name].js" },
    },
  },
});
