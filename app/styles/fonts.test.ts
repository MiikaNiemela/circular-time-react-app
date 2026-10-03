import { describe, it, expect } from "vitest";
import { FONT_FACES, fontFaceCss, fontPreloadLinks } from "./fonts";

describe("web fonts", () => {
  it("serves both families from the app's own origin", () => {
    expect(new Set(FONT_FACES.map((f) => f.family))).toEqual(
      new Set(["Hanken Grotesk", "IBM Plex Mono"])
    );
    for (const face of FONT_FACES) expect(face.url).not.toMatch(/^https?:/);
  });

  it("never swaps a late font in, so text does not shift", () => {
    const rules = fontFaceCss.match(/@font-face\{[^}]*\}/g) ?? [];
    expect(rules).toHaveLength(FONT_FACES.length);
    for (const rule of rules) expect(rule).toContain("font-display:optional");
  });

  it("preloads every font file", () => {
    expect(fontPreloadLinks.map((l) => l.href)).toEqual(FONT_FACES.map((f) => f.url));
    for (const link of fontPreloadLinks) {
      expect(link).toMatchObject({ rel: "preload", as: "font", crossOrigin: "anonymous" });
    }
  });
});
