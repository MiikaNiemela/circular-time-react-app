import { describe, it, expect, vi } from "vitest";
import { OutlookCalendarProvider } from "./OutlookCalendarProvider";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

const RANGE = { start: "2026-06-19T00:00:00Z", end: "2026-06-20T00:00:00Z" };

const token = (value = "at") => vi.fn(async () => value);

describe("OutlookCalendarProvider", () => {
  it("has correct identity", () => {
    const p = new OutlookCalendarProvider({ accessToken: token() });
    expect(p.id).toBe("outlook");
    expect(p.name).toBe("Outlook / Microsoft 365");
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
      accessToken: token(),
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
      accessToken: token(),
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
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect((await p.fetchEvents(RANGE))[0].title).toBe("(no subject)");
  });

  it("returns [] when no items", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}));
    const p = new OutlookCalendarProvider({
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(await p.fetchEvents(RANGE)).toEqual([]);
  });

  it("throws on non-ok events response", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, false, 403));
    const p = new OutlookCalendarProvider({
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/fetch failed: 403/);
  });

  it("asks the token supplier for a token on every fetch", async () => {
    const accessToken = token("server-token");
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const p = new OutlookCalendarProvider({
      accessToken,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await p.fetchEvents(RANGE);

    expect(accessToken).toHaveBeenCalledTimes(1);
    expect((fetchFn.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer server-token",
    });
  });

  it("propagates a credential failure without calling the API", async () => {
    const fetchFn = vi.fn();
    const p = new OutlookCalendarProvider({
      accessToken: vi.fn(async () => {
        throw new Error("Calendar credentials are missing; reconnect required");
      }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/reconnect required/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
