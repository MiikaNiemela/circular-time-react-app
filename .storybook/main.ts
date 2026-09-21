import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: [
    "../app/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp",
  ],
  framework: "@storybook/react-vite",
  viteFinal: async (config) => {
    // React Router's Vite plugin requires a real vite.config context and
    // throws when Storybook runs its own Vite build. Strip it out here.
    const filtered = (config.plugins ?? []).flat().filter(
      (p) => p && "name" in p && !(p as { name: string }).name.startsWith("react-router")
    );
    config.plugins = [vanillaExtractPlugin(), ...filtered];
    // Storybook starts two Vite instances (manager + preview); both default to
    // HMR WS port 24678. Give the preview a distinct port to avoid the conflict.
    config.server ??= {};
    config.server.hmr = { ...(typeof config.server.hmr === 'object' ? config.server.hmr : {}), port: 24679 };
    // VS Code on Windows writes files atomically (temp→rename) which chokidar's
    // native watcher can miss. Polling trades CPU for reliable change detection.
    config.server.watch = { usePolling: true, interval: 300 };
    return config;
  },
};
export default config;
