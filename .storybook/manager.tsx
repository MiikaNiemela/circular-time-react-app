import React from "react";
import { addons, types, useGlobals } from "storybook/manager-api";
import { ToggleButton } from "storybook/internal/components";

function ThemeToggle() {
  const [{ theme }, updateGlobals] = useGlobals();
  const isDark = theme === "dark";

  return (
    <ToggleButton
      padding="small"
      variant="ghost"
      pressed={isDark}
      ariaLabel="Dark mode"
      tooltip={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => updateGlobals({ theme: isDark ? "light" : "dark" })}
    >
      Dark mode
    </ToggleButton>
  );
}

addons.register("circular-time/theme", () => {
  addons.add("circular-time/theme/toggle", {
    title: "Theme",
    type: types.TOOL,
    match: ({ viewMode }) => viewMode === "story" || viewMode === "docs",
    render: () => <ThemeToggle />,
  });
});
