import { describe, it, expect } from "vitest";
import { arcPath } from "./Slice";

const cx = 100;
const cy = 100;
const r = 90;

describe("arcPath", () => {
  it("returns null for a full 360° slice", () => {
    expect(arcPath(cx, cy, r, 0, 360)).toBeNull();
    expect(arcPath(cx, cy, r, 0, 400)).toBeNull();
  });

  it("sets large-arc flag to 1 for slices > 180°", () => {
    const d = arcPath(cx, cy, r, 0, 270);
    expect(d).toMatch(/ 1 1 /);
  });

  it("sets large-arc flag to 0 for slices ≤ 180°", () => {
    const d = arcPath(cx, cy, r, 0, 90);
    expect(d).toMatch(/ 0 1 /);
  });

  it("starts at the top (12 o'clock) when startDeg is 0", () => {
    // At 0° the start point should be (cx, cy - r) = (100, 10)
    const d = arcPath(cx, cy, r, 0, 90);
    expect(d).toMatch(/^M 100 10/);
  });

  it("produces a path string beginning with M and containing A", () => {
    const d = arcPath(cx, cy, r, 0, 45);
    expect(d).toBeTruthy();
    expect(d).toMatch(/^M .+ A /);
  });

  it("uses sweep-flag 1 (clockwise)", () => {
    const d = arcPath(cx, cy, r, 0, 90);
    // SVG arc: A rx ry x-rot large-arc sweep x y → sweep is the 5th param
    expect(d).toMatch(/ 0 1 /);
  });
});
