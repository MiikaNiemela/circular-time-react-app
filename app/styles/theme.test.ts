import { describe, it, expect } from "vitest";
import { vars, lightTheme, darkTheme } from "./theme.css";
import { palette, space, fontSize, radius, font } from "./primitives";

describe("theme contract", () => {
  it("lightTheme and darkTheme produce distinct class names", () => {
    expect(lightTheme).toBeTruthy();
    expect(darkTheme).toBeTruthy();
    expect(lightTheme).not.toBe(darkTheme);
  });

  it("vars exposes color tokens", () => {
    expect(vars.color).toHaveProperty("background");
    expect(vars.color).toHaveProperty("text");
    expect(vars.color).toHaveProperty("accent");
    expect(vars.color).toHaveProperty("accentHover");
    expect(vars.color).toHaveProperty("border");
  });

  it("vars exposes the semantic colours migrated from ad-hoc constants", () => {
    expect(vars.color).toHaveProperty("onAccent");
    expect(vars.color).toHaveProperty("danger");
    expect(vars.color).toHaveProperty("overlayShadow");
  });

  it("vars exposes space scale", () => {
    expect(vars.space).toHaveProperty("xs");
    expect(vars.space).toHaveProperty("sm");
    expect(vars.space).toHaveProperty("md");
    expect(vars.space).toHaveProperty("lg");
    expect(vars.space).toHaveProperty("xl");
  });

  it("vars exposes fontSize and radius scales", () => {
    expect(vars.fontSize).toHaveProperty("sm");
    expect(vars.fontSize).toHaveProperty("xl");
    expect(vars.radius).toHaveProperty("full");
  });
});

describe("design primitives (tier 1)", () => {
  it("palette entries are raw colour strings, not CSS var references", () => {
    for (const value of Object.values(palette)) {
      expect(value).not.toMatch(/^var\(/);
      expect(value).toMatch(/^(#|rgba?\()/);
    }
  });

  it("non-colour scales expose the expected steps", () => {
    expect(Object.keys(space)).toEqual(["xs", "sm", "md", "lg", "xl"]);
    expect(Object.keys(fontSize)).toEqual(["sm", "md", "lg", "xl"]);
    expect(Object.keys(radius)).toEqual(["sm", "md", "full"]);
    expect(font).toHaveProperty("body");
  });
});
