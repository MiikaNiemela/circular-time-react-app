import { describe, it, expect, vi } from "vitest";
import { GoogleCalendarProvider } from "./GoogleCalendarProvider";
import { GoogleTokenStore } from "./tokenStore";
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
const RANGE = {
  start: "2026-06-19T00:00:00Z",
  end: "2026-06-20T00:00:00Z",
};

function storeWith(tokens: object): GoogleTokenStore {
  const store = new GoogleTokenStore(memoryStorage());
  store.set(tokens as never);
  return store;
}

describe("GoogleCalendarProvider", () => {
  it("has the expected identity", () => {
    const p = new GoogleCalendarProvider({ clientId: "c" });
    expect(p.id).toBe("google");
    expect(p.name).toBe("Google Calendar");
  });

  it("throws when not connected", async () => {
    const p = new GoogleCalendarProvider({
      clientId: "c",
      tokenStore: new GoogleTokenStore(memoryStorage()),
    });
    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/not connected/);
  });

  it("fetches and maps timed events", async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        items: [
          {
            id: "e1",
            summary: "Standup",
            start: { dateTime: "2026-06-19T09:00:00Z" },
            end: { dateTime: "2026-06-19T09:15:00Z" },
          },
        ],
      })
    );
    const p = new GoogleCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "at", refreshToken: "rt", expiresAt: FUTURE }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const events = await p.fetchEvents(RANGE);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "e1",
      calendarId: "google",
      title: "Standup",
      allDay: false,
    });

    // Verify the request carried the bearer token and time bounds.
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("timeMin=");
    expect(String(url)).toContain("singleEvents=true");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer at",
    });
  });

  it("maps all-day events using date fields", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        items: [
          {
            id: "e2",
            summary: "Holiday",
            start: { date: "2026-06-19" },
            end: { date: "2026-06-20" },
          },
        ],
      })
    );
    const p = new GoogleCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "at", refreshToken: "rt", expiresAt: FUTURE }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const [evt] = await p.fetchEvents(RANGE);
    expect(evt.allDay).toBe(true);
    expect(evt.title).toBe("Holiday");
  });

  it("titles untitled events", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        items: [
          {
            id: "e3",
            start: { dateTime: "2026-06-19T09:00:00Z" },
            end: { dateTime: "2026-06-19T10:00:00Z" },
          },
        ],
      })
    );
    const p = new GoogleCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "at", refreshToken: "rt", expiresAt: FUTURE }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const [evt] = await p.fetchEvents(RANGE);
    expect(evt.title).toBe("(no title)");
  });

  it("returns [] when the API has no items", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}));
    const p = new GoogleCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "at", refreshToken: "rt", expiresAt: FUTURE }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(await p.fetchEvents(RANGE)).toEqual([]);
  });

  it("refreshes an expired access token before fetching", async () => {
    const fetchFn = vi
      .fn(async (_url: string, _init?: RequestInit) => jsonResponse({}))
      // First call: token refresh
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "fresh", expires_in: 3600, token_type: "Bearer" })
      )
      // Second call: events list
      .mockResolvedValueOnce(jsonResponse({ items: [] }));

    const store = storeWith({
      accessToken: "stale",
      refreshToken: "rt",
      expiresAt: Date.now() - 1000, // already expired
    });
    const p = new GoogleCalendarProvider({
      clientId: "c",
      tokenStore: store,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await p.fetchEvents(RANGE);

    // Token store updated with the refreshed access token.
    expect(store.get()?.accessToken).toBe("fresh");
    // Events request used the fresh token.
    const [, eventsInit] = fetchFn.mock.calls[1];
    expect((eventsInit as RequestInit).headers).toMatchObject({
      Authorization: "Bearer fresh",
    });
  });

  it("throws when expired and no refresh token exists", async () => {
    const p = new GoogleCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "stale", expiresAt: Date.now() - 1000 }),
    });
    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/reconnect required/);
  });

  it("throws on a non-ok events response", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, false, 403));
    const p = new GoogleCalendarProvider({
      clientId: "c",
      tokenStore: storeWith({ accessToken: "at", refreshToken: "rt", expiresAt: FUTURE }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/fetch failed: 403/);
  });
});
