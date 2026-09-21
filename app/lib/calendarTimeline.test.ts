import { describe, it, expect } from "vitest";
import { eventRingsForCalendars } from "./calendarTimeline";
import type { CalendarEventData } from "./calendarTimeline";

const now = new Date("2026-06-19T10:30:00Z");

function calendar(id: string, events: CalendarEventData["events"]): CalendarEventData {
  return {
    calendarId: id,
    events,
    fetchedRange: { start: "2026-06-19T00:00:00Z", end: "2026-06-20T00:00:00Z" },
  };
}

describe("eventRingsForCalendars", () => {
  it("returns no rings when no calendars are visible", () => {
    expect(eventRingsForCalendars([], "day", now)).toEqual([]);
  });

  it("produces one ring per calendar", () => {
    const rings = eventRingsForCalendars(
      [calendar("google", []), calendar("outlook", [])],
      "day",
      now
    );
    expect(rings).toHaveLength(2);
  });

  it("nests each subsequent calendar inside the previous one", () => {
    const rings = eventRingsForCalendars(
      [calendar("a", []), calendar("b", []), calendar("c", [])],
      "week",
      now
    );
    const sizes = rings.map((r) => r.size);
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBeGreaterThan(sizes[2]);
  });

  it("never shrinks a ring below the minimum legible size", () => {
    const many = Array.from({ length: 20 }, (_, i) => calendar(`c${i}`, []));
    const rings = eventRingsForCalendars(many, "month", now);
    expect(Math.min(...rings.map((r) => r.size))).toBeGreaterThanOrEqual(48);
  });

  it("renders an event slice for an event in the current window", () => {
    const rings = eventRingsForCalendars(
      [
        calendar("google", [
          {
            id: "1",
            calendarId: "google",
            title: "Standup",
            start: "2026-06-19T10:00:00Z",
            end: "2026-06-19T10:30:00Z",
          },
        ]),
      ],
      "day",
      now
    );
    // The day window contains this event so its colour should appear.
    const colors = rings[0].slices.map((s) => s.color);
    expect(colors).toContain("#f59e0b");
  });
});
