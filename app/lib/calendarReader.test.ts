import { describe, it, expect, vi } from "vitest";
import { ReconnectRequiredError } from "./calendarCredentials";
import { ProviderHttpError } from "../data/providerErrors";
import { failureReason, readCalendar, type CalendarReaderDeps } from "./calendarReader";
import type { ServerEventCache } from "./serverEventCache";
import type { CalendarProvider } from "../data/types";

const NOW = new Date("2026-10-15T12:00:00Z");
const RANGE = { start: "2026-10-15T00:00:00.000Z", end: "2026-10-16T00:00:00.000Z" };
// The server cache stores whole UTC months; a day inside October reads October.
const OCTOBER = { start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z" };
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
  it("fetches the missing month from the provider, caches it, and returns the requested range", async () => {
    const { cache, set } = memoryCache();
    const LATER = {
      ...EVENT,
      id: "e2",
      start: "2026-10-20T09:00:00.000Z",
      end: "2026-10-20T10:00:00.000Z",
    };
    const fetchEvents = vi.fn(async () => [EVENT, LATER]);

    const result = await readCalendar(
      deps(cache, provider(fetchEvents)),
      "user-1",
      CONNECTION,
      RANGE
    );

    expect(fetchEvents).toHaveBeenCalledWith(OCTOBER);
    expect(set).toHaveBeenCalledWith(
      "user-1",
      "conn-1",
      expect.objectContaining({ range: OCTOBER, events: [EVENT, LATER] })
    );
    expect(result).toEqual({
      calendar: {
        calendarId: "google",
        events: [EVENT],
        fetchedRange: RANGE,
      },
      failure: null,
    });
  });

  // Past months are never refetched automatically.
  it("serves a cached past month without calling the provider", async () => {
    const PAST = { start: "2026-09-10T00:00:00.000Z", end: "2026-09-11T00:00:00.000Z" };
    const SEPT_EVENT = {
      ...EVENT,
      start: "2026-09-10T09:00:00.000Z",
      end: "2026-09-10T09:15:00.000Z",
    };
    const { cache } = memoryCache({
      "google:2026-09-01T00:00:00.000Z": {
        events: [SEPT_EVENT],
        fetchedAt: "2026-10-02T06:00:00.000Z",
      },
    });
    const fetchEvents = vi.fn();

    const result = await readCalendar(
      deps(cache, provider(fetchEvents)),
      "user-1",
      CONNECTION,
      PAST
    );

    expect(fetchEvents).not.toHaveBeenCalled();
    expect(result.calendar.events).toEqual([SEPT_EVENT]);
    expect(result.failure).toBeNull();
  });

  it("serves a near-future month fetched within the freshness period from the cache", async () => {
    const { cache } = memoryCache({
      [`google:${OCTOBER.start}`]: { events: [EVENT], fetchedAt: "2026-10-15T11:50:00.000Z" },
    });
    const fetchEvents = vi.fn();

    const result = await readCalendar(
      deps(cache, provider(fetchEvents)),
      "user-1",
      CONNECTION,
      RANGE
    );

    expect(fetchEvents).not.toHaveBeenCalled();
    expect(result.calendar.events).toEqual([EVENT]);
  });

  it("falls back to cached events and reports the calendar when credentials fail", async () => {
    const { cache } = memoryCache({
      [`google:${OCTOBER.start}`]: { events: [EVENT], fetchedAt: "2026-10-01T00:00:00.000Z" },
    });
    const fetchEvents = vi.fn(async () => {
      throw new ReconnectRequiredError(
        "Calendar access was revoked or expired; reconnect required"
      );
    });

    const result = await readCalendar(
      deps(cache, provider(fetchEvents)),
      "user-1",
      CONNECTION,
      RANGE
    );

    expect(result).toEqual({
      calendar: {
        calendarId: "google",
        events: [EVENT],
        fetchedRange: RANGE,
        cachedRanges: [OCTOBER],
      },
      failure: "reconnect-required",
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
      calendar: { calendarId: "google", events: [], fetchedRange: null, cachedRanges: [] },
      failure: "unavailable",
    });
  });

  it("reports an unsupported provider as failed without fetching", async () => {
    const { cache } = memoryCache();

    const result = await readCalendar(deps(cache, null), "user-1", CONNECTION, RANGE);

    expect(result.failure).toBe("unavailable");
  });

  it("falls back to the cache when building the provider throws", async () => {
    const { cache } = memoryCache({
      [`google:${OCTOBER.start}`]: { events: [EVENT], fetchedAt: "2026-10-01T00:00:00.000Z" },
    });
    const throwingDeps: CalendarReaderDeps = {
      cache,
      providerFor: () => {
        throw new Error("client secret unavailable");
      },
      now: () => NOW,
    };

    const result = await readCalendar(throwingDeps, "user-1", CONNECTION, RANGE);

    expect(result).toEqual({
      calendar: {
        calendarId: "google",
        events: [EVENT],
        fetchedRange: RANGE,
        cachedRanges: [OCTOBER],
      },
      failure: "unavailable",
    });
  });

  describe("cache fallback across a month boundary", () => {
    const BOUNDARY_RANGE = {
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
    const failing = provider(async () => {
      throw new Error("Google Calendar fetch failed: 503");
    });

    it("serves the most recently fetched copy of a spanning event", async () => {
      const { cache } = memoryCache({
        "google:2026-10-01T00:00:00.000Z": {
          events: [span("Old")],
          fetchedAt: "2026-10-31T23:00:00.000Z",
        },
        "google:2026-11-01T00:00:00.000Z": {
          events: [span("New")],
          fetchedAt: "2026-11-01T00:30:00.000Z",
        },
      });

      const result = await readCalendar(deps(cache, failing), "user-1", CONNECTION, BOUNDARY_RANGE);

      expect(result.failure).toBe("unavailable");
      expect(result.calendar.events).toEqual([span("New")]);
    });

    it("drops a spanning event that a more recently fetched month no longer has", async () => {
      const { cache } = memoryCache({
        "google:2026-10-01T00:00:00.000Z": {
          events: [span("Old")],
          fetchedAt: "2026-10-31T23:00:00.000Z",
        },
        "google:2026-11-01T00:00:00.000Z": { events: [], fetchedAt: "2026-11-01T00:30:00.000Z" },
      });

      const result = await readCalendar(deps(cache, failing), "user-1", CONNECTION, BOUNDARY_RANGE);

      expect(result.calendar.events).toEqual([]);
    });
  });
});

describe("failureReason", () => {
  it.each([
    [
      "missing or revoked credentials",
      new ReconnectRequiredError("reconnect required"),
      "reconnect-required",
    ],
    ["a token the provider rejects", new ProviderHttpError("Google", 401), "reconnect-required"],
    ["a provider server error", new ProviderHttpError("Outlook", 503), "unavailable"],
    ["rate limiting after retries", new ProviderHttpError("Google", 429), "unavailable"],
    ["a network failure", new TypeError("fetch failed"), "unavailable"],
    ["anything else", "boom", "unavailable"],
  ])("classifies %s", (_name, error, reason) => {
    expect(failureReason(error)).toBe(reason);
  });
});
