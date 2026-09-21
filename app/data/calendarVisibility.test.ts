import { describe, it, expect } from "vitest";
import { CalendarVisibilityStore } from "./calendarVisibility";
import type { KeyValueStorage } from "./cache";

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("CalendarVisibilityStore", () => {
  it("defaults to visible for unknown calendars", () => {
    const store = new CalendarVisibilityStore(memoryStorage());
    expect(store.isVisible("google")).toBe(true);
  });

  it("persists an explicit hide", () => {
    const storage = memoryStorage();
    new CalendarVisibilityStore(storage).setVisible("google", false);
    // A fresh instance reads the same backing storage.
    expect(new CalendarVisibilityStore(storage).isVisible("google")).toBe(false);
  });

  it("round-trips re-enabling a hidden calendar", () => {
    const store = new CalendarVisibilityStore(memoryStorage());
    store.setVisible("outlook", false);
    store.setVisible("outlook", true);
    expect(store.isVisible("outlook")).toBe(true);
  });

  it("exposes explicit preferences via all()", () => {
    const store = new CalendarVisibilityStore(memoryStorage());
    store.setVisible("google", false);
    expect(store.all()).toEqual({ google: false });
  });

  it("treats corrupt storage as no preferences", () => {
    const storage = memoryStorage();
    storage.setItem("circular-time-calendar-visibility", "{not json");
    expect(new CalendarVisibilityStore(storage).isVisible("google")).toBe(true);
  });
});
