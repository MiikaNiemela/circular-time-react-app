import { describe, it, expect } from "vitest";
import { eventInterval, eventSlicesForView, eventWindow, EVENT_COLORS } from "./eventSlices";
import type { CalendarEvent, TimeRange } from "./types";

// Fixed reference: Friday 2026-06-19, 14:30 local (= UTC in CI)
const NOW = new Date(2026, 5, 19, 14, 30);

function event(id: string, start: string, end: string, color?: string): CalendarEvent {
  return { id, calendarId: "google", title: id, start, end, color };
}

function range(start: string, end: string): TimeRange {
  return { start, end };
}

// ---------------------------------------------------------------------------
// eventWindow — full-period boundaries
// ---------------------------------------------------------------------------
describe("eventWindow", () => {
  it("day → full 24-hour calendar day", () => {
    const w = eventWindow("day", NOW);
    expect(w.start).toBe(new Date(2026, 5, 19).toISOString());
    expect(w.end).toBe(new Date(2026, 5, 20).toISOString());
  });

  it("week → Monday-anchored Mon–Sun (Fri 19 Jun → 15–22 Jun)", () => {
    const w = eventWindow("week", NOW);
    expect(w.start).toBe(new Date(2026, 5, 15).toISOString()); // Mon 15 Jun
    expect(w.end).toBe(new Date(2026, 5, 22).toISOString()); // Mon 22 Jun (exclusive)
  });

  it("month → full calendar month", () => {
    const w = eventWindow("month", NOW);
    expect(w.start).toBe(new Date(2026, 5, 1).toISOString());
    expect(w.end).toBe(new Date(2026, 6, 1).toISOString());
  });

  it("year → full calendar year", () => {
    const w = eventWindow("year", NOW);
    expect(w.start).toBe(new Date(2026, 0, 1).toISOString());
    expect(w.end).toBe(new Date(2027, 0, 1).toISOString());
  });
});

// ---------------------------------------------------------------------------
// Day view — window = full 24-hour day
// ---------------------------------------------------------------------------
describe("eventSlicesForView — day", () => {
  it("fills the day with unknown when never fetched", () => {
    const ring = eventSlicesForView({ events: [], fetchedRange: null, view: "day", now: NOW });
    expect(ring.slices).toHaveLength(1);
    expect(ring.slices[0].color).toBe(EVENT_COLORS.unknown);
    expect(ring.slices[0].degrees).toBeCloseTo(360);
  });

  it("fills the day with free when fetched but no events", () => {
    const ring = eventSlicesForView({
      events: [],
      fetchedRange: range(new Date(2026, 5, 19).toISOString(), new Date(2026, 5, 20).toISOString()),
      view: "day",
      now: NOW,
    });
    expect(ring.slices).toHaveLength(1);
    expect(ring.slices[0].color).toBe(EVENT_COLORS.free);
  });

  it("places a 1-hour event as 1/24 of 360° = 15°", () => {
    const ring = eventSlicesForView({
      events: [
        event("a", new Date(2026, 5, 19, 9).toISOString(), new Date(2026, 5, 19, 10).toISOString()),
      ],
      fetchedRange: range(new Date(2026, 5, 19).toISOString(), new Date(2026, 5, 20).toISOString()),
      view: "day",
      now: NOW,
    });
    const evtSlice = ring.slices.find((s) => s.color === EVENT_COLORS.event);
    expect(evtSlice).toBeDefined();
    expect(evtSlice!.degrees).toBeCloseTo(15); // 1h / 24h * 360
  });

  it("places two non-adjacent events with a gap slice", () => {
    const ring = eventSlicesForView({
      events: [
        event("a", new Date(2026, 5, 19, 9).toISOString(), new Date(2026, 5, 19, 10).toISOString()),
        event(
          "b",
          new Date(2026, 5, 19, 12).toISOString(),
          new Date(2026, 5, 19, 13).toISOString()
        ),
      ],
      fetchedRange: range(new Date(2026, 5, 19).toISOString(), new Date(2026, 5, 20).toISOString()),
      view: "day",
      now: NOW,
    });
    // gap, event, gap, event, gap = 5 slices
    expect(ring.slices).toHaveLength(5);
  });

  it("uses event.color when provided", () => {
    const ring = eventSlicesForView({
      events: [
        event(
          "a",
          new Date(2026, 5, 19, 9).toISOString(),
          new Date(2026, 5, 19, 10).toISOString(),
          "#ff0000"
        ),
      ],
      fetchedRange: range(new Date(2026, 5, 19).toISOString(), new Date(2026, 5, 20).toISOString()),
      view: "day",
      now: NOW,
    });
    expect(ring.slices.find((s) => s.color === "#ff0000")).toBeDefined();
  });

  it("ignores events outside the day window", () => {
    const ring = eventSlicesForView({
      events: [
        event(
          "a",
          new Date(2026, 5, 18, 22).toISOString(),
          new Date(2026, 5, 18, 23).toISOString()
        ),
      ],
      fetchedRange: range(new Date(2026, 5, 19).toISOString(), new Date(2026, 5, 20).toISOString()),
      view: "day",
      now: NOW,
    });
    expect(ring.slices).toHaveLength(1);
    expect(ring.slices[0].color).toBe(EVENT_COLORS.free);
  });
});

// ---------------------------------------------------------------------------
// Week view — window = full Mon–Sun week (7 days = 168 hours)
// ---------------------------------------------------------------------------
describe("eventSlicesForView — week", () => {
  it("places a 1-hour event as 1/168 of 360° ≈ 2.14°", () => {
    const ring = eventSlicesForView({
      events: [
        event("a", new Date(2026, 5, 19, 9).toISOString(), new Date(2026, 5, 19, 10).toISOString()),
      ],
      fetchedRange: range(new Date(2026, 5, 15).toISOString(), new Date(2026, 5, 22).toISOString()),
      view: "week",
      now: NOW,
    });
    const evtSlice = ring.slices.find((s) => s.color === EVENT_COLORS.event);
    expect(evtSlice).toBeDefined();
    expect(evtSlice!.degrees).toBeCloseTo((1 / 168) * 360, 1);
  });
});

// ---------------------------------------------------------------------------
// Month view — window = full calendar month (June 2026 = 30 days)
// ---------------------------------------------------------------------------
describe("eventSlicesForView — month", () => {
  it("places a 1-day event as 1/30 of 360° = 12°", () => {
    const ring = eventSlicesForView({
      events: [
        event("a", new Date(2026, 5, 19).toISOString(), new Date(2026, 5, 20).toISOString()),
      ],
      fetchedRange: range(new Date(2026, 5, 1).toISOString(), new Date(2026, 6, 1).toISOString()),
      view: "month",
      now: NOW,
    });
    const evtSlice = ring.slices.find((s) => s.color === EVENT_COLORS.event);
    expect(evtSlice).toBeDefined();
    expect(evtSlice!.degrees).toBeCloseTo(12); // 1/30 * 360
  });
});

// ---------------------------------------------------------------------------
// Year view — window = full year (2026 = 365 days)
// ---------------------------------------------------------------------------
describe("eventSlicesForView — year", () => {
  it("places a 1-day event as 1/365 of 360°", () => {
    const ring = eventSlicesForView({
      events: [
        event("a", new Date(2026, 5, 19).toISOString(), new Date(2026, 5, 20).toISOString()),
      ],
      fetchedRange: range(new Date(2026, 0, 1).toISOString(), new Date(2027, 0, 1).toISOString()),
      view: "year",
      now: NOW,
    });
    const evtSlice = ring.slices.find((s) => s.color === EVENT_COLORS.event);
    expect(evtSlice).toBeDefined();
    expect(evtSlice!.degrees).toBeCloseTo((1 / 365) * 360, 1);
  });
});

// ---------------------------------------------------------------------------
// Slice degree totals always sum to 360
// ---------------------------------------------------------------------------
describe("degree invariant", () => {
  const views: Array<"day" | "week" | "month" | "year"> = ["day", "week", "month", "year"];

  for (const view of views) {
    it(`slices sum to 360 for ${view} with events`, () => {
      const ring = eventSlicesForView({
        events: [
          event(
            "a",
            new Date(2026, 5, 19, 9).toISOString(),
            new Date(2026, 5, 19, 10, 30).toISOString()
          ),
          event(
            "b",
            new Date(2026, 5, 20, 14).toISOString(),
            new Date(2026, 5, 20, 14, 45).toISOString()
          ),
        ],
        fetchedRange: range(new Date(2026, 0, 1).toISOString(), new Date(2027, 0, 1).toISOString()),
        view,
        now: NOW,
      });
      const total = ring.slices.reduce((s, sl) => s + sl.degrees, 0);
      expect(total).toBeCloseTo(360, 1);
    });
  }
});

// ---------------------------------------------------------------------------
// Cross-boundary events — each overlapping period renders its clamped part
// ---------------------------------------------------------------------------
describe("cross-boundary events", () => {
  const EVER = range("2000-01-01T00:00:00.000Z", "2100-01-01T00:00:00.000Z");
  const local = (...parts: [number, number, number, number?, number?]) =>
    new Date(parts[0], parts[1], parts[2], parts[3] ?? 0, parts[4] ?? 0).toISOString();
  const eventSlice = (ring: { slices: { eventId?: string; degrees: number }[] }, id: string) =>
    ring.slices.find((slice) => slice.eventId === `google:${id}`);
  const total = (ring: { slices: { degrees: number }[] }) =>
    ring.slices.reduce((sum, slice) => sum + slice.degrees, 0);

  /** For each view: an event crossing the period's end, the two periods, and each part's degrees. */
  const cases = [
    {
      view: "day" as const,
      // Fri 19 Jun 22:00 → Sat 20 Jun 02:00: 2h in each day.
      evt: event("x", local(2026, 5, 19, 22), local(2026, 5, 20, 2)),
      before: new Date(2026, 5, 19, 12),
      after: new Date(2026, 5, 20, 12),
      beforeDegrees: (2 / 24) * 360,
      afterDegrees: (2 / 24) * 360,
    },
    {
      view: "week" as const,
      // Sun 21 Jun 12:00 → Mon 22 Jun 12:00 crosses the Monday week boundary: 12h each side.
      evt: event("x", local(2026, 5, 21, 12), local(2026, 5, 22, 12)),
      before: new Date(2026, 5, 19),
      after: new Date(2026, 5, 23),
      beforeDegrees: (12 / (7 * 24)) * 360,
      afterDegrees: (12 / (7 * 24)) * 360,
    },
    {
      view: "month" as const,
      // 29 Jun → 3 Jul: 2 days of June (30 days), 2 days of July (31 days).
      evt: event("x", local(2026, 5, 29), local(2026, 6, 3)),
      before: new Date(2026, 5, 15),
      after: new Date(2026, 6, 15),
      beforeDegrees: (2 / 30) * 360,
      afterDegrees: (2 / 31) * 360,
    },
    {
      view: "year" as const,
      // 30 Dec 2026 → 3 Jan 2027: 2 days of 2026 (365 days), 2 days of 2027 (365 days).
      evt: event("x", local(2026, 11, 30), local(2027, 0, 3)),
      before: new Date(2026, 6, 1),
      after: new Date(2027, 6, 1),
      beforeDegrees: (2 / 365) * 360,
      afterDegrees: (2 / 365) * 360,
    },
  ];

  for (const { view, evt, before, after, beforeDegrees, afterDegrees } of cases) {
    it(`${view}: renders in both overlapping periods, clamped at the boundary`, () => {
      const first = eventSlicesForView({ events: [evt], fetchedRange: EVER, view, now: before });
      const second = eventSlicesForView({ events: [evt], fetchedRange: EVER, view, now: after });

      expect(eventSlice(first, "x")?.degrees).toBeCloseTo(beforeDegrees, 6);
      expect(eventSlice(second, "x")?.degrees).toBeCloseTo(afterDegrees, 6);
      // Clamped at the period end: the event is the last slice of the first
      // period and the first slice of the second.
      expect(first.slices.at(-1)?.eventId).toBe("google:x");
      expect(second.slices[0]?.eventId).toBe("google:x");
      expect(total(first)).toBeCloseTo(360, 6);
      expect(total(second)).toBeCloseTo(360, 6);
    });
  }

  it("fills a period an event spans entirely", () => {
    const ring = eventSlicesForView({
      events: [event("long", local(2026, 5, 18), local(2026, 5, 22))],
      fetchedRange: EVER,
      view: "day",
      now: NOW,
    });

    expect(ring.slices).toEqual([
      expect.objectContaining({ eventId: "google:long", degrees: 360 }),
    ]);
  });

  it("keeps the ring at 360° when events overlap", () => {
    const ring = eventSlicesForView({
      events: [
        event("a", local(2026, 5, 19, 9), local(2026, 5, 19, 11)),
        event("b", local(2026, 5, 19, 10), local(2026, 5, 19, 12)),
        event("inner", local(2026, 5, 19, 9, 30), local(2026, 5, 19, 10, 30)),
      ],
      fetchedRange: EVER,
      view: "day",
      now: NOW,
    });

    expect(total(ring)).toBeCloseTo(360, 6);
    expect(eventSlice(ring, "a")?.degrees).toBeCloseTo((2 / 24) * 360, 6);
    // "b" continues from 11:00, where "a" ends.
    expect(eventSlice(ring, "b")?.degrees).toBeCloseTo((1 / 24) * 360, 6);
    // "inner" lies wholly inside "a" and adds no slice.
    expect(eventSlice(ring, "inner")).toBeUndefined();
  });

  it("renders an all-day event on its own calendar date only", () => {
    // Providers deliver all-day events as UTC midnight of the date.
    const allDay: CalendarEvent = {
      ...event("holiday", "2026-06-19T00:00:00.000Z", "2026-06-20T00:00:00.000Z"),
      allDay: true,
    };

    const sameDay = eventSlicesForView({
      events: [allDay],
      fetchedRange: EVER,
      view: "day",
      now: NOW,
    });
    const nextDay = eventSlicesForView({
      events: [allDay],
      fetchedRange: EVER,
      view: "day",
      now: new Date(2026, 5, 20, 12),
    });

    expect(sameDay.slices).toEqual([
      expect.objectContaining({ eventId: "google:holiday", degrees: 360 }),
    ]);
    expect(eventSlice(nextDay, "holiday")).toBeUndefined();
  });
});

describe("eventInterval", () => {
  it("keeps timed events at their exact instants", () => {
    const evt = event("t", "2026-06-19T09:00:00.000Z", "2026-06-19T10:00:00.000Z");

    expect(eventInterval(evt)).toEqual({
      start: Date.parse("2026-06-19T09:00:00.000Z"),
      end: Date.parse("2026-06-19T10:00:00.000Z"),
    });
  });

  it("anchors all-day events to local midnight of their dates", () => {
    const evt: CalendarEvent = {
      ...event("d", "2026-06-19T00:00:00.000Z", "2026-06-21T00:00:00.000Z"),
      allDay: true,
    };

    expect(eventInterval(evt)).toEqual({
      start: new Date(2026, 5, 19).getTime(),
      end: new Date(2026, 5, 21).getTime(),
    });
  });
});
