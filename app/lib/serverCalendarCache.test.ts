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
    wrapper = new ServerCalendarCache(
      provider,
      cache,
      "user-uuid",
      "connection-uuid",
      () => PAST_NOW
    );
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
      "connection-uuid",
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
      "connection-uuid",
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

  it("fetches the whole month for a shorter range and returns only events in the range", async () => {
    const day: TimeRange = { start: "2026-01-10T00:00:00.000Z", end: "2026-01-11T00:00:00.000Z" };
    const onDay = { ...EVENTS[0], id: "on-day" };
    const otherDay = {
      ...EVENTS[0],
      id: "other-day",
      start: "2026-01-20T09:00:00Z",
      end: "2026-01-20T10:00:00Z",
    };
    cacheGet.mockResolvedValue(null);
    providerFetchEvents.mockResolvedValue([onDay, otherDay]);

    const result = await wrapper.fetchEvents(day);

    expect(providerFetchEvents).toHaveBeenCalledWith(WINDOW);
    expect(cacheSet).toHaveBeenCalledWith(
      "user-uuid",
      "connection-uuid",
      expect.objectContaining({ range: WINDOW, events: [onDay, otherDay] })
    );
    expect(result).toEqual([onDay]);
  });

  describe("events spanning a month boundary", () => {
    // At 01:00 on 1 November, October is past and is not refreshed by the
    // policy, while November is near-future and is.
    const AFTER_BOUNDARY = new Date("2026-11-01T01:00:00.000Z");
    const OCT = { start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z" };
    const NOV = { start: "2026-11-01T00:00:00.000Z", end: "2026-12-01T00:00:00.000Z" };
    const DAY_VIEW: TimeRange = {
      start: "2026-10-31T00:00:00.000Z",
      end: "2026-11-02T00:00:00.000Z",
    };
    const span = (title: string) => ({
      id: "span",
      calendarId: "google",
      title,
      start: "2026-10-31T22:00:00.000Z",
      end: "2026-11-01T02:00:00.000Z",
    });

    function boundaryCache(octEvents: unknown[]) {
      const entries = new Map<string, CacheEntry>([
        [
          OCT.start,
          {
            calendarId: "google",
            range: OCT,
            events: octEvents as CacheEntry["events"],
            fetchedAt: "2026-10-31T23:00:00.000Z",
          },
        ],
      ]);
      const cache: ServerEventCache = {
        get: async (_u, _c, range) => entries.get(range.start) ?? null,
        set: async (_u, _c, entry) => {
          entries.set(entry.range.start, entry);
        },
      };
      return { cache, entries };
    }

    function reader(cache: ServerEventCache, byMonth: Record<string, unknown[]>) {
      const fetchEvents = vi.fn(
        async (window: TimeRange) =>
          (byMonth[window.start] ?? []) as Awaited<ReturnType<CalendarProvider["fetchEvents"]>>
      );
      const wrapper = new ServerCalendarCache(
        { id: "google", name: "Google Calendar", fetchEvents },
        cache,
        "user-uuid",
        "connection-uuid",
        () => AFTER_BOUNDARY
      );
      return { wrapper, fetchEvents };
    }

    it("returns the edited event when a newer month disagrees with a frozen month", async () => {
      const { cache, entries } = boundaryCache([span("Old")]);
      const { wrapper, fetchEvents } = reader(cache, {
        [OCT.start]: [span("New")],
        [NOV.start]: [span("New")],
      });

      const result = await wrapper.fetchEvents(DAY_VIEW);

      expect(result).toEqual([span("New")]);
      // The contradicted past month is refetched once, so the cache agrees too.
      expect(fetchEvents.mock.calls.map(([w]) => w.start)).toEqual([NOV.start, OCT.start]);
      expect(entries.get(OCT.start)?.events).toEqual([span("New")]);
    });

    it("drops an event deleted at the provider that a frozen month still holds", async () => {
      const { cache } = boundaryCache([span("Old")]);
      const { wrapper } = reader(cache, { [OCT.start]: [], [NOV.start]: [] });

      expect(await wrapper.fetchEvents(DAY_VIEW)).toEqual([]);
    });

    it("keeps an event shortened to end before the boundary", async () => {
      const shortened = { ...span("Old"), end: "2026-10-31T23:30:00.000Z" };
      const { cache } = boundaryCache([span("Old")]);
      const { wrapper } = reader(cache, { [OCT.start]: [shortened], [NOV.start]: [] });

      expect(await wrapper.fetchEvents(DAY_VIEW)).toEqual([shortened]);
    });

    it("does not refetch a frozen month that agrees with the newer month", async () => {
      const { cache } = boundaryCache([span("Same")]);
      const { wrapper, fetchEvents } = reader(cache, { [NOV.start]: [span("Same")] });

      expect(await wrapper.fetchEvents(DAY_VIEW)).toEqual([span("Same")]);
      expect(fetchEvents.mock.calls.map(([w]) => w.start)).toEqual([NOV.start]);
    });
  });
});
