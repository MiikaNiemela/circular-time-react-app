import { useTheme } from "./ThemeProvider";
import { button } from "./DarkModeToggle.css";

export function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={button}
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
    >
      {isDark ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
