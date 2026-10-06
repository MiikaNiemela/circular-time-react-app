import { describe, it, expect, vi } from "vitest";
import { OUTLOOK_MAX_PAGES, OutlookCalendarProvider } from "./OutlookCalendarProvider";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return new Response(JSON.stringify(body), { status });
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
    expect(evt.kind).toBe("other");
  });

  it("classifies all-day time off from showAs and requests the field", async () => {
    const fetchFn = vi.fn(async (_url: string) =>
      jsonResponse({
        value: [
          {
            id: "e3",
            subject: "Annual leave",
            isAllDay: true,
            showAs: "oof",
            start: { dateTime: "2026-06-19T00:00:00", timeZone: "UTC" },
            end: { dateTime: "2026-06-20T00:00:00", timeZone: "UTC" },
          },
          {
            id: "e4",
            subject: "Out, but timed",
            isAllDay: false,
            showAs: "oof",
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
    const [leave, timed] = await p.fetchEvents(RANGE);
    expect(leave.kind).toBe("time-off");
    // Out-of-office is classified on timed events too; Google has no all-day out-of-office.
    expect(timed.kind).toBe("time-off");
    const select = new URL(String(fetchFn.mock.calls[0][0])).searchParams.get("$select");
    expect(select?.split(",")).toContain("showAs");
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

  it("follows @odata.nextLink and returns the events from every page", async () => {
    const timed = (id: string) => ({
      id,
      start: { dateTime: "2026-06-19T09:00:00", timeZone: "UTC" },
      end: { dateTime: "2026-06-19T10:00:00", timeZone: "UTC" },
    });
    const next = "https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=abc";
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ value: [timed("p1")], "@odata.nextLink": next }))
      .mockResolvedValueOnce(jsonResponse({ value: [timed("p2")] }));
    const p = new OutlookCalendarProvider({
      accessToken: token("server-token"),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const events = await p.fetchEvents(RANGE);

    expect(events.map((e) => e.id)).toEqual(["p1", "p2"]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1][0]).toBe(next);
    expect((fetchFn.mock.calls[1][1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer server-token",
    });
  });

  it("refuses a next link outside Microsoft Graph without sending the token there", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ value: [], "@odata.nextLink": "https://attacker.example/page2" })
      );
    const p = new OutlookCalendarProvider({
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/outside Microsoft Graph/);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("fails rather than return a partial list when a later page fails", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          value: [],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=x",
        })
      )
      .mockImplementation(async () => jsonResponse({}, false, 503));
    const p = new OutlookCalendarProvider({
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
      retry: { sleep: async () => undefined },
    });

    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/fetch failed: 503/);
    // The first page, then the failing page on each of its three attempts.
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("fails when the result needs more pages than the limit", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        value: [],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=again",
      })
    );
    const p = new OutlookCalendarProvider({
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/exceeded/);
    expect(fetchFn).toHaveBeenCalledTimes(OUTLOOK_MAX_PAGES);
  });
});
