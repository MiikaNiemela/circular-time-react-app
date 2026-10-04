import { describe, it, expect } from "vitest";
import { vars, lightTheme, darkTheme, lightColors, darkColors } from "./theme.css";
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
    expect(vars.color).toHaveProperty("accentFill");
    expect(vars.color).toHaveProperty("border");
  });

  it("vars exposes the semantic colours migrated from ad-hoc constants", () => {
    expect(vars.color).toHaveProperty("onAccent");
    expect(vars.color).toHaveProperty("danger");
    expect(vars.color).toHaveProperty("overlayShadow");
    expect(vars.color).toHaveProperty("now");
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

/** WCAG 2 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each([
  ["light", lightColors],
  ["dark", darkColors],
])("%s theme contrast (WCAG AA)", (_name, colors) => {
  it("text and muted text reach 4.5:1 on the background", () => {
    expect(contrast(colors.text, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textMuted, colors.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("accent text reaches 4.5:1 on the background and the surface", () => {
    expect(contrast(colors.accent, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.accent, colors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("text on the accent fill reaches AAA (7:1)", () => {
    expect(contrast(colors.onAccent, colors.accentFill)).toBeGreaterThanOrEqual(7);
  });

  it("a switch knob stands out 3:1 from its track, off and on", () => {
    // Off: text-coloured knob on the border-coloured track; on: onAccent on accentFill.
    expect(contrast(colors.text, colors.border)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.onAccent, colors.accentFill)).toBeGreaterThanOrEqual(3);
  });

  it("the accent fill stands out 3:1 from the background and the surface", () => {
    expect(contrast(colors.accentFill, colors.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.accentFill, colors.surface)).toBeGreaterThanOrEqual(3);
  });

  it("the now marker reaches the 3:1 non-text contrast on the background", () => {
    expect(contrast(colors.now, colors.background)).toBeGreaterThanOrEqual(3);
  });

  it.each(["allDayBirthday", "allDayTimeOff", "allDayOther"] as const)(
    "the %s icon reaches the 3:1 non-text contrast on the background",
    (role) => {
      expect(contrast(colors[role], colors.background)).toBeGreaterThanOrEqual(3);
    }
  );
});
