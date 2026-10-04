import type { Preview } from "@storybook/react-vite";
import { useGlobals } from "storybook/preview-api";
import { ThemeProvider } from "../app/components/ThemeProvider";
import "./preview.css";

const preview: Preview = {
  initialGlobals: { theme: "light" },
  decorators: [
    function WithTheme(Story) {
      const [{ theme }, updateGlobals] = useGlobals();
      return (
        <ThemeProvider
          theme={theme === "dark" ? "dark" : "light"}
          onThemeChange={(theme) => updateGlobals({ theme })}
        >
          <Story />
        </ThemeProvider>
      );
    },
  ],
  parameters: {
    // The canvas follows the theme instead of Storybook's independent background picker.
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "error",
    },
  },
};

export default preview;
