import { describe, it, expect } from "vitest";
import { defaultStreamName, moveItem, parseStreamChange, MAX_STREAM_NAME } from "./streams";

describe("moveItem", () => {
  it("moves an item up and down, and leaves the ends alone", () => {
    expect(moveItem(["a", "b", "c"], 1, "up")).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, "down")).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b", "c"], 0, "up")).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 2, "down")).toEqual(["a", "b", "c"]);
    expect(moveItem(["a"], 5, "up")).toEqual(["a"]);
  });
});

describe("defaultStreamName", () => {
  it.each([
    ["google", "Google Calendar"],
    ["outlook", "Outlook"],
    ["other", "other"],
  ])("names %s %s", (provider, name) => {
    expect(defaultStreamName(provider)).toBe(name);
  });
});

describe("parseStreamChange", () => {
  it.each([
    [
      { intent: "rename", streamId: "s1", name: "  Work  " },
      { intent: "rename", streamId: "s1", name: "Work" },
    ],
    [
      { intent: "move", streamId: "s1", direction: "up" },
      { intent: "move", streamId: "s1", direction: "up" },
    ],
    [
      { intent: "set-visible", streamId: "s1", visible: false },
      { intent: "set-visible", streamId: "s1", visible: false },
    ],
    [
      { intent: "assign", calendarConnectionId: "c1", streamId: null },
      { intent: "assign", calendarConnectionId: "c1", streamId: null },
    ],
    [
      { intent: "assign", calendarConnectionId: "c1", streamId: "s2" },
      { intent: "assign", calendarConnectionId: "c1", streamId: "s2" },
    ],
    [
      { intent: "delete", streamId: "s1" },
      { intent: "delete", streamId: "s1" },
    ],
  ])("accepts %j", (body, change) => {
    expect(parseStreamChange(body)).toEqual(change);
  });

  it.each([
    null,
    [],
    "rename",
    {},
    { intent: "explode", streamId: "s1" },
    { intent: "rename", streamId: "s1", name: "   " },
    { intent: "rename", streamId: "s1", name: "x".repeat(MAX_STREAM_NAME + 1) },
    { intent: "rename", streamId: "", name: "Work" },
    { intent: "move", streamId: "s1", direction: "left" },
    { intent: "set-visible", streamId: "s1", visible: "no" },
    { intent: "assign", calendarConnectionId: "c1" },
    { intent: "delete", streamId: 7 },
    { intent: "delete", streamId: "s".repeat(65) },
  ])("rejects %j", (body) => {
    expect(parseStreamChange(body)).toBeNull();
  });
});
