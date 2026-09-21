import { describe, it, expect } from "vitest";
import { splitIntoMonthlyWindows, deduplicateEvents } from "./serverRefreshPolicy";

describe("splitIntoMonthlyWindows", () => {
  it("returns a single window when range fits within one month", () => {
    const range = { start: "2026-01-10T00:00:00.000Z", end: "2026-01-25T00:00:00.000Z" };
    const result = splitIntoMonthlyWindows(range);
    expect(result).toEqual([range]);
  });

  it("splits a two-month range at the UTC month boundary", () => {
    const range = { start: "2026-01-15T00:00:00.000Z", end: "2026-03-01T00:00:00.000Z" };
    const result = splitIntoMonthlyWindows(range);
    expect(result).toEqual([
      { start: "2026-01-15T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z" },
      { start: "2026-02-01T00:00:00.000Z", end: "2026-03-01T00:00:00.000Z" },
    ]);
  });

  it("splits a full year into 12 windows aligned to month starts", () => {
    const range = { start: "2026-01-01T00:00:00.000Z", end: "2027-01-01T00:00:00.000Z" };
    const result = splitIntoMonthlyWindows(range);
    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-02-01T00:00:00.000Z",
    });
    expect(result[11]).toEqual({
      start: "2026-12-01T00:00:00.000Z",
      end: "2027-01-01T00:00:00.000Z",
    });
  });

  it("handles a range starting mid-month and ending mid-month across a year boundary", () => {
    const range = { start: "2026-11-15T00:00:00.000Z", end: "2027-02-10T00:00:00.000Z" };
    const result = splitIntoMonthlyWindows(range);
    expect(result).toEqual([
      { start: "2026-11-15T00:00:00.000Z", end: "2026-12-01T00:00:00.000Z" },
      { start: "2026-12-01T00:00:00.000Z", end: "2027-01-01T00:00:00.000Z" },
      { start: "2027-01-01T00:00:00.000Z", end: "2027-02-01T00:00:00.000Z" },
      { start: "2027-02-01T00:00:00.000Z", end: "2027-02-10T00:00:00.000Z" },
    ]);
  });

  it("windows are contiguous — each end equals the next start", () => {
    const range = { start: "2026-03-05T00:00:00.000Z", end: "2026-06-20T00:00:00.000Z" };
    const windows = splitIntoMonthlyWindows(range);
    for (let i = 0; i + 1 < windows.length; i++) {
      expect(windows[i].end).toBe(windows[i + 1].start);
    }
  });

  it("first window start equals range.start and last window end equals range.end", () => {
    const range = { start: "2026-05-10T12:30:00.000Z", end: "2026-08-20T15:45:00.000Z" };
    const windows = splitIntoMonthlyWindows(range);
    expect(windows[0].start).toBe(range.start);
    expect(windows[windows.length - 1].end).toBe(range.end);
  });
});

describe("deduplicateEvents", () => {
  it("returns an empty array unchanged", () => {
    expect(deduplicateEvents([])).toEqual([]);
  });

  it("returns events unchanged when all ids are unique", () => {
    const events = [
      {
        id: "a",
        calendarId: "g",
        title: "A",
        start: "2026-01-01T09:00:00Z",
        end: "2026-01-01T10:00:00Z",
      },
      {
        id: "b",
        calendarId: "g",
        title: "B",
        start: "2026-01-02T09:00:00Z",
        end: "2026-01-02T10:00:00Z",
      },
    ];
    expect(deduplicateEvents(events)).toEqual(events);
  });

  it("removes duplicates, keeping the first occurrence", () => {
    const e1 = {
      id: "dup",
      calendarId: "g",
      title: "First",
      start: "2026-01-01T09:00:00Z",
      end: "2026-01-01T10:00:00Z",
    };
    const e2 = {
      id: "dup",
      calendarId: "g",
      title: "Second",
      start: "2026-01-01T09:00:00Z",
      end: "2026-01-01T10:00:00Z",
    };
    const result = deduplicateEvents([e1, e2]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("First");
  });

  it("handles multiple distinct duplicates", () => {
    const events = [
      {
        id: "a",
        calendarId: "g",
        title: "A1",
        start: "2026-01-01T09:00:00Z",
        end: "2026-01-01T10:00:00Z",
      },
      {
        id: "b",
        calendarId: "g",
        title: "B1",
        start: "2026-01-02T09:00:00Z",
        end: "2026-01-02T10:00:00Z",
      },
      {
        id: "a",
        calendarId: "g",
        title: "A2",
        start: "2026-01-01T09:00:00Z",
        end: "2026-01-01T10:00:00Z",
      },
      {
        id: "b",
        calendarId: "g",
        title: "B2",
        start: "2026-01-02T09:00:00Z",
        end: "2026-01-02T10:00:00Z",
      },
      {
        id: "c",
        calendarId: "g",
        title: "C",
        start: "2026-01-03T09:00:00Z",
        end: "2026-01-03T10:00:00Z",
      },
    ];
    const result = deduplicateEvents(events);
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(result.map((e) => e.title)).toEqual(["A1", "B1", "C"]);
  });
});
