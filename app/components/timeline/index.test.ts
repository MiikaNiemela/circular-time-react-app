import { describe, it, expect } from "vitest";
import * as api from ".";

describe("timeline public API", () => {
  it("exports Circle component", () => {
    expect(api.Circle).toBeTypeOf("function");
  });

  it("exports MultiCircle component", () => {
    expect(api.MultiCircle).toBeTypeOf("function");
  });

  it("does not export internal helpers", () => {
    expect((api as Record<string, unknown>).arcPath).toBeUndefined();
    expect((api as Record<string, unknown>).ringRadius).toBeUndefined();
  });
});
