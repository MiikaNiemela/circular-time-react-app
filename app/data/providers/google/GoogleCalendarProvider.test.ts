import { describe, it, expect, vi } from "vitest";
import { GOOGLE_MAX_PAGES, GoogleCalendarProvider } from "./GoogleCalendarProvider";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return new Response(JSON.stringify(body), { status });
}

const RANGE = {
  start: "2026-06-19T00:00:00Z",
  end: "2026-06-20T00:00:00Z",
};

const token = (value = "at") => vi.fn(async () => value);

describe("GoogleCalendarProvider", () => {
  it("has the expected identity", () => {
    const p = new GoogleCalendarProvider({ accessToken: token() });
    expect(p.id).toBe("google");
    expect(p.name).toBe("Google Calendar");
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
      accessToken: token(),
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
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const [evt] = await p.fetchEvents(RANGE);
    expect(evt.allDay).toBe(true);
    expect(evt.title).toBe("Holiday");
    expect(evt.kind).toBe("other");
  });

  it("classifies all-day birthdays and time off from eventType", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        items: [
          {
            id: "b",
            summary: "Mara's birthday",
            eventType: "birthday",
            start: { date: "2026-06-19" },
            end: { date: "2026-06-20" },
          },
          {
            id: "o",
            summary: "Annual leave",
            eventType: "outOfOffice",
            start: { date: "2026-06-19" },
            end: { date: "2026-06-20" },
          },
          {
            id: "t",
            summary: "Out, but timed",
            eventType: "outOfOffice",
            start: { dateTime: "2026-06-19T09:00:00Z" },
            end: { dateTime: "2026-06-19T10:00:00Z" },
          },
        ],
      })
    );
    const p = new GoogleCalendarProvider({
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const [birthday, leave, timed] = await p.fetchEvents(RANGE);
    expect(birthday.kind).toBe("birthday");
    expect(leave.kind).toBe("time-off");
    // Out-of-office is classified on timed events too; Google has no all-day out-of-office.
    expect(timed.kind).toBe("time-off");
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
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const [evt] = await p.fetchEvents(RANGE);
    expect(evt.title).toBe("(no title)");
  });

  it("returns [] when the API has no items", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}));
    const p = new GoogleCalendarProvider({
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(await p.fetchEvents(RANGE)).toEqual([]);
  });

  it("throws on a non-ok events response", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, false, 403));
    const p = new GoogleCalendarProvider({
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/fetch failed: 403/);
  });

  it("asks the token supplier for a token on every fetch", async () => {
    const accessToken = token("server-token");
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    const p = new GoogleCalendarProvider({
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
    const p = new GoogleCalendarProvider({
      accessToken: vi.fn(async () => {
        throw new Error("Calendar credentials are missing; reconnect required");
      }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/reconnect required/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("follows nextPageToken and returns the events from every page", async () => {
    const timed = (id: string) => ({
      id,
      start: { dateTime: "2026-06-19T09:00:00Z" },
      end: { dateTime: "2026-06-19T10:00:00Z" },
    });
    const pages: Record<string, unknown> = {
      first: { items: [timed("p1")], nextPageToken: "t2" },
      t2: { items: [timed("p2")], nextPageToken: "t3" },
      t3: { items: [timed("p3")] },
    };
    const fetchFn = vi.fn(async (url: string, _init?: RequestInit) =>
      jsonResponse(pages[new URL(url).searchParams.get("pageToken") ?? "first"])
    );
    const accessToken = token();
    const p = new GoogleCalendarProvider({
      accessToken,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const events = await p.fetchEvents(RANGE);

    expect(events.map((e) => e.id)).toEqual(["p1", "p2", "p3"]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(accessToken).toHaveBeenCalledTimes(1);
    // Each page keeps the original range and filters.
    for (const [url] of fetchFn.mock.calls) {
      expect(new URL(url).searchParams.get("timeMin")).toBe("2026-06-19T00:00:00.000Z");
      expect(new URL(url).searchParams.get("singleEvents")).toBe("true");
    }
  });

  it("fails rather than return a partial list when a later page fails", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [], nextPageToken: "t2" }))
      .mockImplementation(async () => jsonResponse({}, false, 500));
    const p = new GoogleCalendarProvider({
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
      retry: { sleep: async () => undefined },
    });

    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/fetch failed: 500/);
    // The first page, then the failing page on each of its three attempts.
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("fails when the result needs more pages than the limit", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ items: [], nextPageToken: "again" }));
    const p = new GoogleCalendarProvider({
      accessToken: token(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(p.fetchEvents(RANGE)).rejects.toThrow(/exceeded/);
    expect(fetchFn).toHaveBeenCalledTimes(GOOGLE_MAX_PAGES);
  });
});
