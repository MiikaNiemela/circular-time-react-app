import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCalendarTimeline } from "./useCalendarTimeline";

vi.mock("../data/providers/google/config", () => ({ GOOGLE_CLIENT_ID: "test-google-id" }));
vi.mock("../data/providers/outlook/config", () => ({ OUTLOOK_CLIENT_ID: "test-outlook-id" }));

const mocks = vi.hoisted(() => ({
  googleGet: vi.fn(),
  outlookGet: vi.fn(),
  googleFetch: vi.fn(),
  outlookFetch: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  isVisible: vi.fn(),
  eventWindow: vi.fn(),
  shouldRefresh: vi.fn(),
}));

vi.mock("../data/providers/google", () => ({
  GoogleTokenStore: class {
    get = mocks.googleGet;
  },
  GoogleCalendarProvider: class {
    fetchEvents = mocks.googleFetch;
  },
}));

vi.mock("../data/providers/outlook", () => ({
  OutlookTokenStore: class {
    get = mocks.outlookGet;
  },
  OutlookCalendarProvider: class {
    fetchEvents = mocks.outlookFetch;
  },
}));

const RANGE = { start: "2026-06-20T00:00:00Z", end: "2026-06-21T00:00:00Z" };

vi.mock("../data", () => ({
  CalendarCache: class {
    get = mocks.cacheGet;
    set = mocks.cacheSet;
  },
  CalendarVisibilityStore: class {
    isVisible = mocks.isVisible;
  },
  eventWindow: (...args: unknown[]) => mocks.eventWindow(...args),
  shouldRefresh: (...args: unknown[]) => mocks.shouldRefresh(...args),
}));

const REFERENCE = new Date("2026-06-20T10:00:00Z");

describe("useCalendarTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.googleGet.mockReturnValue(null);
    mocks.outlookGet.mockReturnValue(null);
    mocks.cacheGet.mockReturnValue(undefined);
    mocks.isVisible.mockReturnValue(true);
    mocks.eventWindow.mockReturnValue(RANGE);
    mocks.shouldRefresh.mockReturnValue(true);
  });

  it("returns empty calendars and no failures when no providers are connected", async () => {
    const { result } = renderHook(() => useCalendarTimeline("day", REFERENCE));
    await waitFor(() => expect(result.current.failedCalendars).toEqual([]));
    expect(result.current.calendars).toEqual([]);
  });

  it("populates calendars with fetched events and reports no failures on success", async () => {
    mocks.googleGet.mockReturnValue("tok");
    const events = [
      {
        id: "e1",
        calendarId: "google",
        title: "Standup",
        start: "2026-06-20T09:00:00Z",
        end: "2026-06-20T09:30:00Z",
      },
    ];
    mocks.googleFetch.mockResolvedValue(events);

    const { result } = renderHook(() => useCalendarTimeline("day", REFERENCE));
    await waitFor(() => expect(result.current.calendars).toHaveLength(1));

    expect(result.current.calendars[0]).toMatchObject({ calendarId: "google", events });
    expect(result.current.failedCalendars).toEqual([]);
  });

  it("adds the provider id to failedCalendars when fetch throws and returns empty cached events", async () => {
    mocks.googleGet.mockReturnValue("tok");
    mocks.googleFetch.mockRejectedValue(new Error("401 Unauthorized"));

    const { result } = renderHook(() => useCalendarTimeline("day", REFERENCE));
    await waitFor(() => expect(result.current.failedCalendars).toEqual(["google"]));

    expect(result.current.calendars).toHaveLength(1);
    expect(result.current.calendars[0].events).toEqual([]);
  });

  it("reports both providers failed when both fetches throw", async () => {
    mocks.googleGet.mockReturnValue("tok");
    mocks.outlookGet.mockReturnValue("tok");
    mocks.googleFetch.mockRejectedValue(new Error("google expired"));
    mocks.outlookFetch.mockRejectedValue(new Error("outlook expired"));

    const { result } = renderHook(() => useCalendarTimeline("day", REFERENCE));
    await waitFor(() => expect(result.current.failedCalendars).toHaveLength(2));

    expect(result.current.failedCalendars).toContain("google");
    expect(result.current.failedCalendars).toContain("outlook");
  });

  it("returns empty immediately and skips all fetching when enabled is false", async () => {
    mocks.googleGet.mockReturnValue("tok");
    mocks.googleFetch.mockResolvedValue([]);

    const { result } = renderHook(() => useCalendarTimeline("day", REFERENCE, { enabled: false }));

    // Give the effect time to run (it shouldn't).
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.googleFetch).not.toHaveBeenCalled();
    expect(result.current.calendars).toEqual([]);
    expect(result.current.failedCalendars).toEqual([]);
  });

  it("calls onFetched with the cache entry after a successful fetch", async () => {
    mocks.googleGet.mockReturnValue("tok");
    const events = [
      {
        id: "e1",
        calendarId: "google",
        title: "Standup",
        start: "2026-06-20T09:00:00Z",
        end: "2026-06-20T09:30:00Z",
      },
    ];
    mocks.googleFetch.mockResolvedValue(events);
    const onFetched = vi.fn();

    const { result } = renderHook(() =>
      useCalendarTimeline("day", REFERENCE, { enabled: true, onFetched })
    );
    await waitFor(() => expect(result.current.calendars).toHaveLength(1));

    expect(onFetched).toHaveBeenCalledOnce();
    expect(onFetched).toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "google", events })
    );
  });

  it("does not call onFetched when the fetch fails", async () => {
    mocks.googleGet.mockReturnValue("tok");
    mocks.googleFetch.mockRejectedValue(new Error("network error"));
    const onFetched = vi.fn();

    const { result } = renderHook(() =>
      useCalendarTimeline("day", REFERENCE, { enabled: true, onFetched })
    );
    await waitFor(() => expect(result.current.failedCalendars).toContain("google"));

    expect(onFetched).not.toHaveBeenCalled();
  });
});
