import { describe, it, expect } from "vitest";
import { googleEventKind, outlookEventKind } from "./allDayKind";

describe("googleEventKind", () => {
  it.each([
    ["birthday", "birthday"],
    ["outOfOffice", "time-off"],
    ["default", "other"],
    ["focusTime", "other"],
    ["workingLocation", "other"],
    [undefined, "other"],
  ])("classifies eventType %s as %s", (eventType, kind) => {
    expect(googleEventKind(eventType)).toBe(kind);
  });
});

describe("outlookEventKind", () => {
  it.each([
    ["oof", "time-off"],
    ["busy", "other"],
    ["free", "other"],
    ["tentative", "other"],
    ["workingElsewhere", "other"],
    [undefined, "other"],
  ])("classifies showAs %s as %s", (showAs, kind) => {
    expect(outlookEventKind(showAs)).toBe(kind);
  });
});
