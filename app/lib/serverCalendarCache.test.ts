import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServerCalendarCache } from "./serverCalendarCache";
import type { CalendarProvider, TimeRange } from "../data/types";
import type { ServerEventCache } from "./serverEventCache";
import type { CacheEntry } from "../data/cache";

// Single-month range — produces exactly one window after splitting.
const RANGE: TimeRange = { start: "2026-01-01T00:00:00Z", end: "2026-02-01T00:00:00Z" };
// After `splitIntoMonthlyWindows` start/end are serialised through Date.toISOString().
const WINDOW = { start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z" };
const EVENTS = [
  {
    id: "e1",
    calendarId: "google",
    title: "Meeting",
    start: "2026-01-10T09:00:00Z",
    end: "2026-01-10T10:00:00Z",
  },
];
// NOW is after RANGE.end, so the window is entirely in the past → shouldRefresh returns false.
const PAST_NOW = new Date("2026-03-01T00:00:00Z");

describe("ServerCalendarCache", () => {
  let providerFetchEvents: ReturnType<typeof vi.fn>;
  let cacheGet: ReturnType<typeof vi.fn>;
  let cacheSet: ReturnType<typeof vi.fn>;
  let wrapper: ServerCalendarCache;

  beforeEach(() => {
    providerFetchEvents = vi.fn();
    cacheGet = vi.fn();
    cacheSet = vi.fn().mockResolvedValue(undefined);
    const provider = {
      id: "google",
      name: "Google Calendar",
      fetchEvents: providerFetchEvents as CalendarProvider["fetchEvents"],
    } as CalendarProvider;
    const cache = {
      get: cacheGet as ServerEventCache["get"],
      set: cacheSet as ServerEventCache["set"],
    } as ServerEventCache;
    wrapper = new ServerCalendarCache(provider, cache, "user-uuid", () => PAST_NOW);
  });

  it("delegates id and name to the underlying provider", () => {
    expect(wrapper.id).toBe("google");
    expect(wrapper.name).toBe("Google Calendar");
  });

  it("returns cached events when the entry is fresh (no provider call)", async () => {
    const entry: CacheEntry = {
      calendarId: "google",
      range: WINDOW,
      events: EVENTS,
      fetchedAt: "2026-01-15T00:00:00Z",
    };
    cacheGet.mockResolvedValue(entry);
    const result = await wrapper.fetchEvents(RANGE);
    expect(result).toEqual(EVENTS);
    expect(providerFetchEvents).not.toHaveBeenCalled();
  });

  it("calls provider and caches result on a cache miss", async () => {
    cacheGet.mockResolvedValue(null);
    providerFetchEvents.mockResolvedValue(EVENTS);
    const result = await wrapper.fetchEvents(RANGE);
    expect(result).toEqual(EVENTS);
    expect(providerFetchEvents).toHaveBeenCalledWith(WINDOW);
    expect(cacheSet).toHaveBeenCalledWith(
      "user-uuid",
      expect.objectContaining({
        calendarId: "google",
        range: WINDOW,
        events: EVENTS,
      })
    );
  });

  it("calls provider when the cached entry is stale (near-future window)", async () => {
    // staleNow is mid-January: the Jan window's start is within one day of now,
    // so shouldRefresh returns true (stale).
    const staleNow = new Date("2026-01-15T00:00:00Z");
    const providerFn = vi.fn().mockResolvedValue(EVENTS);
    const staleWrapper = new ServerCalendarCache(
      {
        id: "google",
        name: "Google Calendar",
        fetchEvents: providerFn as CalendarProvider["fetchEvents"],
      },
      { get: cacheGet as ServerEventCache["get"], set: cacheSet as ServerEventCache["set"] },
      "user-uuid",
      () => staleNow
    );
    const entry: CacheEntry = {
      calendarId: "google",
      range: WINDOW,
      events: [],
      fetchedAt: "2026-01-10T00:00:00Z",
    };
    cacheGet.mockResolvedValue(entry);
    const result = await staleWrapper.fetchEvents(RANGE);
    expect(result).toEqual(EVENTS);
    expect(providerFn).toHaveBeenCalledWith(WINDOW);
    expect(cacheSet).toHaveBeenCalled();
  });

  it("serves fresh windows from cache and only fetches stale ones", async () => {
    // Two-month range splits into Jan and Feb windows.
    const twoMonthRange: TimeRange = { start: "2026-01-01T00:00:00Z", end: "2026-03-01T00:00:00Z" };
    const janWindow = { start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z" };
    const febWindow = { start: "2026-02-01T00:00:00.000Z", end: "2026-03-01T00:00:00.000Z" };
    const janEvents = [
      {
        id: "jan",
        calendarId: "google",
        title: "Jan event",
        start: "2026-01-15T09:00:00Z",
        end: "2026-01-15T10:00:00Z",
      },
    ];
    const febEvents = [
      {
        id: "feb",
        calendarId: "google",
        title: "Feb event",
        start: "2026-02-10T09:00:00Z",
        end: "2026-02-10T10:00:00Z",
      },
    ];
    // Jan is cached and fresh (PAST_NOW = Mar 1 > Feb 1 so rangeEnd is in the past).
    const janEntry: CacheEntry = {
      calendarId: "google",
      range: janWindow,
      events: janEvents,
      fetchedAt: "2026-01-20T00:00:00Z",
    };
    cacheGet.mockImplementation((_uid, _cid, range) => {
      if (range.start === janWindow.start) return Promise.resolve(janEntry);
      return Promise.resolve(null);
    });
    providerFetchEvents.mockResolvedValue(febEvents);

    const result = await wrapper.fetchEvents(twoMonthRange);

    expect(providerFetchEvents).toHaveBeenCalledOnce();
    expect(providerFetchEvents).toHaveBeenCalledWith(febWindow);
    expect(result).toEqual([...janEvents, ...febEvents]);
  });

  it("deduplicates events returned for multiple windows", async () => {
    // Two-month range; the provider returns the same multi-day event for both windows.
    const twoMonthRange: TimeRange = { start: "2026-01-01T00:00:00Z", end: "2026-03-01T00:00:00Z" };
    const multiDayEvent = {
      id: "span",
      calendarId: "google",
      title: "Multi-day",
      start: "2026-01-31T09:00:00Z",
      end: "2026-02-03T09:00:00Z",
    };
    cacheGet.mockResolvedValue(null);
    providerFetchEvents.mockResolvedValue([multiDayEvent]);

    const result = await wrapper.fetchEvents(twoMonthRange);

    expect(providerFetchEvents).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("span");
  });
});
