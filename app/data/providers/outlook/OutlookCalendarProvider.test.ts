import { describe, it, expect, vi } from "vitest";
import { OutlookCalendarProvider } from "./OutlookCalendarProvider";
import { OutlookTokenStore } from "./tokenStore";
import type { KeyValueStorage } from "../../cache";

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

const FUTURE = Date.now() + 3_600_000;
const RANGE = { start: "2026-06-19T00:00:00Z", end: "2026-06-20T00:00:00Z" };

function storeWith(tokens: object): OutlookTokenStore {
  const store = new OutlookTokenStore(memoryStorage());
  store.set(tokens as never);
  return store;
}

describe("OutlookCalendarProvider", () => {
  it("has correct identity", () => {
    const p = new OutlookCalendarProvider({ clientId: "c" });
    expect(p.id).toBe("outlook");
    expect(p.name).toBe("Outlook / Microsoft 365");
  });

  it("throws when not connected", async () => {
    const p = new OutlookCalendarProvider({
      clientId: "c",
      tokenStore: new OutlookTokenStore(memoryStorage()),
    });
    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/not connected/);
  });

  it("fetches and maps timed events", async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        value: [
          {
            id: "e1",
            subject: "Standup",
            isAllDay: false,
            start: { dateTime: "2026-06-19T09:00:00", timeZone: "UTC" },
            end: { dateTime: "2026-06-19T09:15:00", timeZone: "UTC" },
          },
        ],
      })
    );
    const p = new OutlookCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "at", refreshToken: "rt", expiresAt: FUTURE }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const events = await p.fetchEvents(RANGE);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "e1",
      calendarId: "outlook",
      title: "Standup",
      allDay: false,
    });
    const [url] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("calendarView");
    expect(String(url)).toContain("startDateTime=");
  });

  it("maps all-day events", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        value: [
          {
            id: "e2",
            subject: "Holiday",
            isAllDay: true,
            start: { dateTime: "2026-06-19T00:00:00", timeZone: "UTC" },
            end: { dateTime: "2026-06-20T00:00:00", timeZone: "UTC" },
          },
        ],
      })
    );
    const p = new OutlookCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "at", refreshToken: "rt", expiresAt: FUTURE }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const [evt] = await p.fetchEvents(RANGE);
    expect(evt.allDay).toBe(true);
  });

  it("titles untitled events", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        value: [
          {
            id: "e3",
            isAllDay: false,
            start: { dateTime: "2026-06-19T09:00:00", timeZone: "UTC" },
            end: { dateTime: "2026-06-19T10:00:00", timeZone: "UTC" },
          },
        ],
      })
    );
    const p = new OutlookCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "at", refreshToken: "rt", expiresAt: FUTURE }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect((await p.fetchEvents(RANGE))[0].title).toBe("(no subject)");
  });

  it("returns [] when no items", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}));
    const p = new OutlookCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "at", refreshToken: "rt", expiresAt: FUTURE }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(await p.fetchEvents(RANGE)).toEqual([]);
  });

  it("refreshes expired access token before fetching", async () => {
    const fetchFn = vi
      .fn(async (_url: string, _init?: RequestInit) => jsonResponse({}))
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "fresh", expires_in: 3600, token_type: "Bearer" })
      )
      .mockResolvedValueOnce(jsonResponse({ value: [] }));

    const store = storeWith({
      accessToken: "stale",
      refreshToken: "rt",
      expiresAt: Date.now() - 1000,
    });
    const p = new OutlookCalendarProvider({
      clientId: "c",
      tokenStore: store,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await p.fetchEvents(RANGE);
    expect((store as OutlookTokenStore).get()?.accessToken).toBe("fresh");
  });

  it("throws when expired and no refresh token", async () => {
    const p = new OutlookCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "stale", expiresAt: Date.now() - 1000 }),
    });
    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/reconnect required/);
  });

  it("throws on non-ok events response", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, false, 403));
    const p = new OutlookCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "at", refreshToken: "rt", expiresAt: FUTURE }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/fetch failed: 403/);
  });
});
