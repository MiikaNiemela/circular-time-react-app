import { describe, it, expect, beforeEach } from "vitest";
import { CalendarCache, type CacheEntry, type KeyValueStorage } from "./cache";
import type { CalendarEvent } from "./types";

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function event(id: string, calendarId: string): CalendarEvent {
  return {
    id,
    calendarId,
    title: `Event ${id}`,
    start: "2026-06-19T09:00:00.000Z",
    end: "2026-06-19T10:00:00.000Z",
  };
}

function entry(calendarId: string, events: CalendarEvent[]): CacheEntry {
  return {
    calendarId,
    range: { start: "2026-06-19T00:00:00.000Z", end: "2026-06-20T00:00:00.000Z" },
    events,
    fetchedAt: "2026-06-19T11:00:00.000Z",
  };
}

describe("CalendarCache", () => {
  let storage: KeyValueStorage;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it("returns undefined for an unknown calendar", () => {
    const cache = new CalendarCache(storage);
    expect(cache.get("google")).toBeUndefined();
  });

  it("stores and retrieves an entry", () => {
    const cache = new CalendarCache(storage);
    const e = entry("google", [event("1", "google")]);
    cache.set(e);
    expect(cache.get("google")).toEqual(e);
  });

  it("replaces an existing entry for the same calendar", () => {
    const cache = new CalendarCache(storage);
    cache.set(entry("google", [event("1", "google")]));
    cache.set(entry("google", [event("2", "google")]));
    expect(cache.get("google")?.events).toHaveLength(1);
    expect(cache.get("google")?.events[0].id).toBe("2");
  });

  it("lists all entries", () => {
    const cache = new CalendarCache(storage);
    cache.set(entry("google", []));
    cache.set(entry("outlook", []));
    expect(cache.entries().map((e) => e.calendarId)).toEqual(["google", "outlook"]);
  });

  it("removes a single entry", () => {
    const cache = new CalendarCache(storage);
    cache.set(entry("google", []));
    cache.set(entry("outlook", []));
    cache.remove("google");
    expect(cache.get("google")).toBeUndefined();
    expect(cache.get("outlook")).toBeDefined();
  });

  it("clears all entries", () => {
    const cache = new CalendarCache(storage);
    cache.set(entry("google", []));
    cache.clear();
    expect(cache.entries()).toHaveLength(0);
  });

  it("persists across instances sharing the same storage", () => {
    const a = new CalendarCache(storage);
    a.set(entry("google", [event("1", "google")]));

    const b = new CalendarCache(storage);
    expect(b.get("google")?.events[0].id).toBe("1");
  });

  it("starts fresh when persisted data is corrupt", () => {
    storage.setItem("circular-time-cache", "{not valid json");
    const cache = new CalendarCache(storage);
    expect(cache.entries()).toHaveLength(0);
  });
});
