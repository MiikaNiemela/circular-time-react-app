import { describe, it, expect } from "vitest";
import { googleAllDayKind, outlookAllDayKind } from "./allDayKind";

describe("googleAllDayKind", () => {
  it.each([
    ["birthday", "birthday"],
    ["outOfOffice", "time-off"],
    ["default", "other"],
    ["focusTime", "other"],
    ["workingLocation", "other"],
    [undefined, "other"],
  ])("classifies eventType %s as %s", (eventType, kind) => {
    expect(googleAllDayKind(eventType)).toBe(kind);
  });
});

describe("outlookAllDayKind", () => {
  it.each([
    ["oof", "time-off"],
    ["busy", "other"],
    ["free", "other"],
    ["tentative", "other"],
    ["workingElsewhere", "other"],
    [undefined, "other"],
  ])("classifies showAs %s as %s", (showAs, kind) => {
    expect(outlookAllDayKind(showAs)).toBe(kind);
  });
});
