import { describe, it, expect } from "vitest";
import {
  deduplicateEvents,
  eventsOverlapping,
  monthlyWindowsCovering,
} from "./serverRefreshPolicy";

describe("monthlyWindowsCovering", () => {
  it("covers a range inside one month with that whole month", () => {
    const range = { start: "2026-01-10T00:00:00.000Z", end: "2026-01-25T00:00:00.000Z" };
    expect(monthlyWindowsCovering(range)).toEqual([
      { start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z" },
    ]);
  });

  it("gives every range inside a month the same window, so views share cache keys", () => {
    const day = { start: "2026-10-14T00:00:00.000Z", end: "2026-10-17T00:00:00.000Z" };
    const week = { start: "2026-10-11T00:00:00.000Z", end: "2026-10-20T00:00:00.000Z" };
    expect(monthlyWindowsCovering(day)).toEqual(monthlyWindowsCovering(week));
  });

  it("treats the range end as exclusive", () => {
    const range = { start: "2026-01-15T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z" };
    expect(monthlyWindowsCovering(range)).toEqual([
      { start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z" },
    ]);
  });

  it("covers a range crossing a year boundary with each whole month", () => {
    const range = { start: "2026-11-15T00:00:00.000Z", end: "2027-02-10T00:00:00.000Z" };
    expect(monthlyWindowsCovering(range)).toEqual([
      { start: "2026-11-01T00:00:00.000Z", end: "2026-12-01T00:00:00.000Z" },
      { start: "2026-12-01T00:00:00.000Z", end: "2027-01-01T00:00:00.000Z" },
      { start: "2027-01-01T00:00:00.000Z", end: "2027-02-01T00:00:00.000Z" },
      { start: "2027-02-01T00:00:00.000Z", end: "2027-03-01T00:00:00.000Z" },
    ]);
  });

  it("covers a full year with 12 contiguous windows", () => {
    const range = { start: "2026-01-01T00:00:00.000Z", end: "2027-01-01T00:00:00.000Z" };
    const windows = monthlyWindowsCovering(range);
    expect(windows).toHaveLength(12);
    for (let i = 0; i + 1 < windows.length; i++) {
      expect(windows[i].end).toBe(windows[i + 1].start);
    }
  });

  it("returns no windows for an empty range", () => {
    const at = "2026-05-10T12:00:00.000Z";
    expect(monthlyWindowsCovering({ start: at, end: at })).toEqual([]);
  });
});

describe("eventsOverlapping", () => {
  const RANGE = { start: "2026-10-15T00:00:00.000Z", end: "2026-10-16T00:00:00.000Z" };
  const event = (id: string, start: string, end: string) => ({
    id,
    calendarId: "g",
    title: id,
    start,
    end,
  });

  it("keeps events inside, crossing either edge, or spanning the range", () => {
    const events = [
      event("inside", "2026-10-15T09:00:00.000Z", "2026-10-15T10:00:00.000Z"),
      event("crosses-start", "2026-10-14T23:00:00.000Z", "2026-10-15T01:00:00.000Z"),
      event("crosses-end", "2026-10-15T23:00:00.000Z", "2026-10-16T01:00:00.000Z"),
      event("spans", "2026-10-01T00:00:00.000Z", "2026-10-31T00:00:00.000Z"),
    ];
    expect(eventsOverlapping(events, RANGE)).toEqual(events);
  });

  it("drops events that only touch the range edges", () => {
    const events = [
      event("ends-at-start", "2026-10-14T23:00:00.000Z", "2026-10-15T00:00:00.000Z"),
      event("starts-at-end", "2026-10-16T00:00:00.000Z", "2026-10-16T01:00:00.000Z"),
      event("other-day", "2026-10-20T09:00:00.000Z", "2026-10-20T10:00:00.000Z"),
    ];
    expect(eventsOverlapping(events, RANGE)).toEqual([]);
  });

  it("keeps a zero-length event only when its instant is inside the range", () => {
    const atStart = event("at-start", RANGE.start, RANGE.start);
    const atEnd = event("at-end", RANGE.end, RANGE.end);
    expect(eventsOverlapping([atStart, atEnd], RANGE)).toEqual([atStart]);
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
