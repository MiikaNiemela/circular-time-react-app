import { describe, it, expect } from "vitest";
import { eventSlicesForView, eventWindow, EVENT_COLORS } from "./eventSlices";
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
