import { describe, it, expect, vi } from "vitest";
import { readCalendar, type CalendarReaderDeps } from "./calendarReader";
import type { ServerEventCache } from "./serverEventCache";
import type { CalendarProvider } from "../data/types";

const NOW = new Date("2026-10-15T12:00:00Z");
const RANGE = { start: "2026-10-15T00:00:00.000Z", end: "2026-10-16T00:00:00.000Z" };
const CONNECTION = { id: "conn-1", provider: "google", providerUserId: "sub-1" };
const EVENT = {
  id: "e1",
  calendarId: "google",
  title: "Standup",
  start: "2026-10-15T09:00:00.000Z",
  end: "2026-10-15T09:15:00.000Z",
};

function memoryCache(
  entries: Record<string, { events: (typeof EVENT)[]; fetchedAt: string }> = {}
) {
  const set = vi.fn(async () => {});
  const cache: ServerEventCache = {
    get: async (_userId, calendarId, range) => {
      const entry = entries[`${calendarId}:${range.start}`];
      return entry ? { calendarId, range, ...entry } : null;
    },
    set,
  };
  return { cache, set };
}

function provider(fetchEvents: CalendarProvider["fetchEvents"]): CalendarProvider {
  return { id: "google", name: "Google Calendar", fetchEvents };
}

function deps(cache: ServerEventCache, p: CalendarProvider | null): CalendarReaderDeps {
  return { cache, providerFor: () => p, now: () => NOW };
}

describe("readCalendar", () => {
  // Monthly windows are clipped to the requested range, so a day is one window.
  it("fetches a missing window from the provider and stores it in the server cache", async () => {
    const { cache, set } = memoryCache();
    const fetchEvents = vi.fn(async () => [EVENT]);

    const result = await readCalendar(
      deps(cache, provider(fetchEvents)),
      "user-1",
      CONNECTION,
      RANGE
    );

    expect(fetchEvents).toHaveBeenCalledWith(RANGE);
    expect(set).toHaveBeenCalledWith("user-1", "conn-1", expect.objectContaining({ range: RANGE }));
    expect(result).toEqual({
      calendar: { calendarId: "google", events: [EVENT], fetchedRange: RANGE },
      failed: false,
    });
  });

  // The refresh policy refetches anything reaching into the next day; past
  // windows are served from the cache.
  it("serves a cached past window without calling the provider", async () => {
    const PAST = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-02T00:00:00.000Z" };
    const { cache } = memoryCache({
      [`google:${PAST.start}`]: { events: [EVENT], fetchedAt: "2026-10-02T06:00:00.000Z" },
    });
    const fetchEvents = vi.fn();

    const result = await readCalendar(
      deps(cache, provider(fetchEvents)),
      "user-1",
      CONNECTION,
      PAST
    );

    expect(fetchEvents).not.toHaveBeenCalled();
    expect(result.calendar.events).toEqual([EVENT]);
    expect(result.failed).toBe(false);
  });

  it("falls back to cached events and reports the calendar when credentials fail", async () => {
    const { cache } = memoryCache({
      [`google:${RANGE.start}`]: { events: [EVENT], fetchedAt: "2026-10-01T00:00:00.000Z" },
    });
    const fetchEvents = vi.fn(async () => {
      throw new Error("Calendar access was revoked or expired; reconnect required");
    });

    const result = await readCalendar(
      deps(cache, provider(fetchEvents)),
      "user-1",
      CONNECTION,
      RANGE
    );

    expect(result).toEqual({
      calendar: { calendarId: "google", events: [EVENT], fetchedRange: RANGE },
      failed: true,
    });
  });

  it("marks uncached ranges unknown when the provider fails with nothing cached", async () => {
    const { cache } = memoryCache();
    const fetchEvents = vi.fn(async () => {
      throw new Error("Google Calendar fetch failed: 503");
    });

    const result = await readCalendar(
      deps(cache, provider(fetchEvents)),
      "user-1",
      CONNECTION,
      RANGE
    );

    expect(result).toEqual({
      calendar: { calendarId: "google", events: [], fetchedRange: null },
      failed: true,
    });
  });

  it("reports an unsupported provider as failed without fetching", async () => {
    const { cache } = memoryCache();

    const result = await readCalendar(deps(cache, null), "user-1", CONNECTION, RANGE);

    expect(result.failed).toBe(true);
  });
});
