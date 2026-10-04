import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { darkTheme, lightTheme } from "../styles/theme.css";

beforeEach(() => {
  localStorage.clear();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe("useTheme", () => {
  it("defaults to light theme", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
  });

  it("toggleTheme switches between light and dark", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("dark");
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");
  });

  it("persists theme preference in localStorage", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.toggleTheme());
    expect(localStorage.getItem("circular-time-theme")).toBe("dark");
  });

  it("follows an external theme and preserves the saved app preference", () => {
    let selectedTheme: "light" | "dark" = "light";
    localStorage.setItem("circular-time-theme", "dark");
    const onThemeChange = vi.fn();
    const { result, rerender } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider theme={selectedTheme} onThemeChange={onThemeChange}>
          {children}
        </ThemeProvider>
      ),
    });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains(lightTheme)).toBe(true);
    act(() => result.current.toggleTheme());
    expect(onThemeChange).toHaveBeenCalledWith("dark");
    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem("circular-time-theme")).toBe("dark");

    selectedTheme = "dark";
    rerender();
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains(darkTheme)).toBe(true);
    expect(document.documentElement.classList.contains(lightTheme)).toBe(false);
    act(() => result.current.toggleTheme());
    expect(onThemeChange).toHaveBeenLastCalledWith("light");
  });
});
