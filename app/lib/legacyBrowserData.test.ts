import { describe, it, expect } from "vitest";
import { removeLegacyBrowserCalendarData } from "./legacyBrowserData";

describe("removeLegacyBrowserCalendarData", () => {
  it("removes browser-held provider tokens and cached events, keeping preferences", () => {
    localStorage.setItem("circular-time-google-tokens", "{}");
    localStorage.setItem("circular-time-outlook-tokens", "{}");
    localStorage.setItem("circular-time-cache", "{}");
    localStorage.setItem("circular-time-calendar-visibility", '{"google":false}');

    removeLegacyBrowserCalendarData();

    expect(localStorage.getItem("circular-time-google-tokens")).toBeNull();
    expect(localStorage.getItem("circular-time-outlook-tokens")).toBeNull();
    expect(localStorage.getItem("circular-time-cache")).toBeNull();
    expect(localStorage.getItem("circular-time-calendar-visibility")).toBe('{"google":false}');
  });
});
