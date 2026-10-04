import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { darkTheme, lightTheme } from "../styles/theme.css";

type Theme = "light" | "dark";

const STORAGE_KEY = "circular-time-theme";

function getSystemTheme(): Theme {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable
  }
  return null;
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Control the theme externally, without changing the saved app preference. */
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

export function ThemeProvider({
  children,
  theme: controlledTheme,
  onThemeChange,
}: ThemeProviderProps) {
  // Lazy initializer reads localStorage/matchMedia on first client render only;
  // SSR gets the "light" fallback since neither API is available server-side.
  const [storedTheme, setTheme] = useState<Theme>(() =>
    typeof window !== "undefined" ? (getStoredTheme() ?? getSystemTheme()) : "light"
  );
  const theme = controlledTheme ?? storedTheme;

  useEffect(() => {
    const root = document.documentElement;
    const add = theme === "dark" ? darkTheme : lightTheme;
    const remove = theme === "dark" ? lightTheme : darkTheme;
    root.classList.remove(remove);
    root.classList.add(add);
    if (controlledTheme !== undefined) return;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable
    }
  }, [theme, controlledTheme]);

  const toggleTheme = useCallback(() => {
    if (controlledTheme !== undefined) {
      onThemeChange?.(controlledTheme === "light" ? "dark" : "light");
    } else {
      setTheme((t) => (t === "light" ? "dark" : "light"));
    }
  }, [controlledTheme, onThemeChange]);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
