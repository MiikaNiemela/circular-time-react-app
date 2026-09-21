import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Enforces that the timeline component library has no coupling to app-level
 * modules — a prerequisite for future extraction into a standalone package.
 *
 * "App-level" means anything outside app/components/timeline/ itself:
 * routes, the vanilla-extract theme contract, ThemeProvider, root, etc.
 */

const TIMELINE_DIR = join(import.meta.dirname, ".");

const FORBIDDEN_PATTERNS = [
  /from\s+["'].*\/routes\//, // React Router routes
  /from\s+["'].*styles\/theme/, // vanilla-extract theme contract
  /from\s+["'].*ThemeProvider/, // app ThemeProvider
  /from\s+["']react-router/, // React Router framework imports
  /from\s+["']@react-router\//, // React Router dev packages
];

function sourceFiles(): string[] {
  return readdirSync(TIMELINE_DIR)
    .filter(
      (f) =>
        (f.endsWith(".ts") || f.endsWith(".tsx")) &&
        !f.endsWith(".test.ts") &&
        !f.endsWith(".test.tsx") &&
        !f.endsWith(".stories.ts") &&
        !f.endsWith(".stories.tsx")
    )
    .map((f) => join(TIMELINE_DIR, f));
}

describe("timeline — no app coupling", () => {
  const files = sourceFiles();

  it("has source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const name = file.split("/").slice(-2).join("/");
    const contents = readFileSync(file, "utf-8");

    for (const pattern of FORBIDDEN_PATTERNS) {
      it(`${name} does not import ${pattern.source}`, () => {
        expect(contents).not.toMatch(pattern);
      });
    }
  }
});
