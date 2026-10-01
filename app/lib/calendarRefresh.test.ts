import { describe, it, expect, vi } from "vitest";
import { refreshCalendars, type CalendarRefreshDeps } from "./calendarRefresh";
import { ReconnectRequiredError } from "./calendarCredentials";
import type { ServerEventCache } from "./serverEventCache";
import type { CacheEntry } from "../data/cache";
import type { CalendarProvider } from "../data/types";
import type { OwnedCalendarConnection } from "./userRepository";

// Mid-month, so the near-future range (now → now + 1 day) lies in October.
const NOW = new Date("2026-10-15T12:00:00.000Z");
const OCTOBER = { start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z" };
const NOVEMBER = { start: "2026-11-01T00:00:00.000Z", end: "2026-12-01T00:00:00.000Z" };

const GOOGLE: OwnedCalendarConnection = {
  id: "conn-g",
  userId: "user-1",
  provider: "google",
  providerUserId: "g-sub",
};
const OUTLOOK: OwnedCalendarConnection = {
  id: "conn-o",
  userId: "user-2",
  provider: "outlook",
  providerUserId: "o-sub",
};

/** An in-memory cache keyed by user, calendar, and window start. */
function memoryCache(seed: Array<{ userId: string } & CacheEntry> = []) {
  const entries = new Map<string, CacheEntry>();
  const key = (userId: string, calendarId: string, start: string) =>
    `${userId}:${calendarId}:${start}`;
  for (const { userId, ...entry } of seed) {
    entries.set(key(userId, entry.calendarId, entry.range.start), entry);
  }
  const set = vi.fn(async (userId: string, _connectionId: string, entry: CacheEntry) => {
    entries.set(key(userId, entry.calendarId, entry.range.start), entry);
  });
  const cache: ServerEventCache = {
    get: async (userId, calendarId, range) =>
      entries.get(key(userId, calendarId, range.start)) ?? null,
    set,
  };
  return { cache, set, entries };
}

function provider(id: string, fetchEvents: CalendarProvider["fetchEvents"]): CalendarProvider {
  return { id, name: id, fetchEvents };
}

function deps(
  cache: ServerEventCache,
  connections: OwnedCalendarConnection[],
  providers: Record<string, CalendarProvider | null>,
  now: Date = NOW
): CalendarRefreshDeps {
  return {
    listConnections: async () => connections,
    cache,
    providerFor: (_userId, connection) => providers[connection.provider] ?? null,
    now: () => now,
  };
}

describe("refreshCalendars", () => {
  it("fetches the near-future month of every connection and stores it for its owner", async () => {
    const { cache, set } = memoryCache();
    const google = vi.fn(async () => []);
    const outlook = vi.fn(async () => []);

    const summary = await refreshCalendars(
      deps(cache, [GOOGLE, OUTLOOK], {
        google: provider("google", google),
        outlook: provider("outlook", outlook),
      })
    );

    expect(summary).toEqual({ attempted: 2, refreshed: 2, failures: [] });
    expect(google).toHaveBeenCalledExactlyOnceWith(OCTOBER);
    expect(outlook).toHaveBeenCalledExactlyOnceWith(OCTOBER);
    expect(set).toHaveBeenCalledWith(
      "user-1",
      "conn-g",
      expect.objectContaining({
        calendarId: "google",
        range: OCTOBER,
        fetchedAt: NOW.toISOString(),
      })
    );
    expect(set).toHaveBeenCalledWith(
      "user-2",
      "conn-o",
      expect.objectContaining({ calendarId: "outlook", range: OCTOBER })
    );
  });

  it("refreshes both months when the near-future range crosses a month boundary", async () => {
    const { cache } = memoryCache();
    const google = vi.fn(async () => []);

    await refreshCalendars(
      deps(
        cache,
        [GOOGLE],
        { google: provider("google", google) },
        new Date("2026-10-31T18:00:00.000Z")
      )
    );

    expect(google.mock.calls).toEqual([[OCTOBER], [NOVEMBER]]);
  });

  it("leaves a month fetched within the freshness period alone", async () => {
    const { cache, set } = memoryCache([
      {
        userId: "user-1",
        calendarId: "google",
        range: OCTOBER,
        events: [],
        fetchedAt: "2026-10-15T11:55:00.000Z",
      },
    ]);
    const google = vi.fn(async () => []);

    const summary = await refreshCalendars(
      deps(cache, [GOOGLE], { google: provider("google", google) })
    );

    expect(google).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(summary.refreshed).toBe(1);
  });

  it("refetches a stale month and replaces the cached events", async () => {
    const stale = {
      id: "old",
      calendarId: "google",
      title: "Old",
      start: "2026-10-15T15:00:00.000Z",
      end: "2026-10-15T16:00:00.000Z",
    };
    const fresh = { ...stale, id: "new", title: "New" };
    const { cache, entries } = memoryCache([
      {
        userId: "user-1",
        calendarId: "google",
        range: OCTOBER,
        events: [stale],
        fetchedAt: "2026-10-15T09:00:00.000Z",
      },
    ]);

    await refreshCalendars(
      deps(cache, [GOOGLE], { google: provider("google", async () => [fresh]) })
    );

    expect(entries.get(`user-1:google:${OCTOBER.start}`)).toEqual({
      calendarId: "google",
      range: OCTOBER,
      events: [fresh],
      fetchedAt: NOW.toISOString(),
    });
  });

  it("records a connection that needs reconnecting and continues with the others", async () => {
    const { cache } = memoryCache();
    const outlook = vi.fn(async () => []);

    const summary = await refreshCalendars(
      deps(cache, [GOOGLE, OUTLOOK], {
        google: provider("google", async () => {
          throw new ReconnectRequiredError("Calendar access was revoked or expired");
        }),
        outlook: provider("outlook", outlook),
      })
    );

    expect(outlook).toHaveBeenCalled();
    expect(summary).toEqual({
      attempted: 2,
      refreshed: 1,
      failures: [
        { calendarConnectionId: "conn-g", provider: "google", reason: "reconnect-required" },
      ],
    });
  });

  it("records provider errors and unsupported providers without user or error details", async () => {
    const { cache } = memoryCache();
    const ICAL: OwnedCalendarConnection = { ...GOOGLE, id: "conn-i", provider: "ical" };

    const summary = await refreshCalendars(
      deps(cache, [GOOGLE, ICAL], {
        google: provider("google", async () => {
          throw new Error("Google Calendar fetch failed: 503 for user-1");
        }),
      })
    );

    expect(summary).toEqual({
      attempted: 2,
      refreshed: 0,
      failures: [
        { calendarConnectionId: "conn-g", provider: "google", reason: "provider-error" },
        { calendarConnectionId: "conn-i", provider: "ical", reason: "unsupported-provider" },
      ],
    });
  });

  it("reports an empty run when no connection has stored credentials", async () => {
    const { cache } = memoryCache();

    await expect(refreshCalendars(deps(cache, [], {}))).resolves.toEqual({
      attempted: 0,
      refreshed: 0,
      failures: [],
    });
  });
});
