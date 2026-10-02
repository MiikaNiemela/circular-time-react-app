import { describe, it, expect } from "vitest";
import {
  contradictedWindows,
  eventsOverlapping,
  mergeWindows,
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

describe("mergeWindows and contradictedWindows", () => {
  const OCT = { start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z" };
  const NOV = { start: "2026-11-01T00:00:00.000Z", end: "2026-12-01T00:00:00.000Z" };
  const EARLY = "2026-10-31T23:00:00.000Z";
  const LATE = "2026-11-01T00:30:00.000Z";
  const event = (id: string, title: string, start: string, end: string) => ({
    id,
    calendarId: "g",
    title,
    start,
    end,
  });
  const span = (title: string) =>
    event("span", title, "2026-10-31T22:00:00.000Z", "2026-11-01T02:00:00.000Z");
  const octOnly = event("oct", "Oct", "2026-10-10T09:00:00.000Z", "2026-10-10T10:00:00.000Z");

  it("keeps one copy of an event held by two windows fetched together, in window order", () => {
    const windows = [
      { range: OCT, fetchedAt: LATE, events: [octOnly, span("Same")] },
      { range: NOV, fetchedAt: LATE, events: [span("Same")] },
    ];
    expect(mergeWindows(windows)).toEqual([octOnly, span("Same")]);
    expect(contradictedWindows(windows)).toEqual([]);
  });

  it("uses the most recently fetched copy of an event", () => {
    const windows = [
      { range: OCT, fetchedAt: EARLY, events: [span("Old")] },
      { range: NOV, fetchedAt: LATE, events: [span("New")] },
    ];
    expect(mergeWindows(windows)).toEqual([span("New")]);
    expect(contradictedWindows(windows)).toEqual([0]);
  });

  it("drops a copy that a more recently fetched overlapping window no longer holds", () => {
    const windows = [
      { range: OCT, fetchedAt: EARLY, events: [octOnly, span("Old")] },
      { range: NOV, fetchedAt: LATE, events: [] },
    ];
    expect(mergeWindows(windows)).toEqual([octOnly]);
    expect(contradictedWindows(windows)).toEqual([0]);
  });

  it("ignores newer windows that do not overlap the event", () => {
    const windows = [
      { range: OCT, fetchedAt: EARLY, events: [octOnly] },
      { range: NOV, fetchedAt: LATE, events: [] },
    ];
    expect(mergeWindows(windows)).toEqual([octOnly]);
    expect(contradictedWindows(windows)).toEqual([]);
  });

  it("does not let an older window contradict a newer one", () => {
    const windows = [
      { range: OCT, fetchedAt: LATE, events: [span("New")] },
      { range: NOV, fetchedAt: EARLY, events: [] },
    ];
    expect(mergeWindows(windows)).toEqual([span("New")]);
    expect(contradictedWindows(windows)).toEqual([]);
  });
});
