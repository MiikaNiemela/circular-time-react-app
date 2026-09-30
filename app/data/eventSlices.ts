/**
 * Maps CalendarEvents from the cache into RingConfig slices for MultiCircle.
 *
 * Design rules:
 * - Events are placed chronologically from the top (12 o'clock), matching the
 *   same angular coordinate system as timeSlices.ts.
 * - Each view defines its own "unit" (hour/day/week/month). An event occupies
 *   the angular range proportional to its [start, end) overlap with the view.
 * - The outer ring shows the background time-of-day/week/month grid;
 *   the inner ring overlays calendar events for the current unit.
 * - An "unknown" colour marks ranges for which no fetch has been done, so the
 *   UI can distinguish "empty" (fetched, no events) from "unknown" (never fetched).
 */

import type { CalendarEvent, TimeRange } from "./types";
import type { RingConfig, Slice } from "../components/timeline";
import type { TimeView } from "../components/SegmentedControl";
import { palette } from "../styles/primitives";

/** Semantic slice colours, aliased from the tier-1 palette. */
export const EVENT_COLORS = {
  /** A calendar event block. */
  event: palette.amber500,
  /** Free/empty time inside a fetched range. */
  free: palette.gray200,
  /** Range whose data has never been fetched. */
  unknown: palette.gray300,
} as const;

/** Clamp a value between [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Returns an event's [start, end) instants for rendering.
 *
 * Providers deliver an all-day event as UTC midnight of its calendar date(s).
 * An all-day event belongs to those dates in the viewer's calendar, so it is
 * re-anchored to local midnight; otherwise, east or west of UTC it would spill
 * across a day boundary into the neighbouring day.
 */
export function eventInterval(event: CalendarEvent): { start: number; end: number } {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (!event.allDay) return { start: start.getTime(), end: end.getTime() };
  const localMidnight = (d: Date) =>
    new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
  return { start: localMidnight(start), end: localMidnight(end) };
}

/**
 * Converts a list of events (all assumed to overlap the `window`) into an
 * ordered set of slices that cover the window exactly 360 degrees.
 *
 * Events are sorted by start time and clamped to the window, so an event that
 * crosses a period boundary renders only its in-period part. The ring is a
 * single track: where events overlap, a later event continues from where the
 * earlier one ends, and an event wholly inside an earlier one adds no slice.
 * That keeps the slices within the period. Gaps between events (and before
 * the first / after the last) become free or unknown slices depending on
 * `isFetched`.
 */
function eventsToSlices(
  events: CalendarEvent[],
  windowStart: number,
  windowEnd: number,
  isFetched: boolean
): Slice[] {
  const gapColor = isFetched ? EVENT_COLORS.free : EVENT_COLORS.unknown;
  const windowMs = windowEnd - windowStart;
  if (windowMs <= 0) return [];

  // Order by start, then longest first so a containing event claims the arc
  // before the events inside it, then by ID so identical intervals render the
  // same way whatever order the provider or cache returns them in.
  const sorted = events
    .map((evt) => ({ evt, key: `${evt.calendarId}:${evt.id}`, ...eventInterval(evt) }))
    .sort(
      (a, b) => a.start - b.start || b.end - a.end || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
    );

  const slices: Slice[] = [];
  let cursor = windowStart;

  for (const { evt, start, end } of sorted) {
    // Clamp to the period, then to the part not already drawn by an earlier
    // overlapping event, so the ring never exceeds 360 degrees.
    const evtStart = Math.max(clamp(start, windowStart, windowEnd), cursor);
    const evtEnd = clamp(end, windowStart, windowEnd);
    if (evtEnd <= evtStart) continue;

    if (evtStart > cursor) {
      // Gap before this event.
      slices.push({ color: gapColor, degrees: ((evtStart - cursor) / windowMs) * 360 });
    }
    slices.push({
      color: evt.color ?? EVENT_COLORS.event,
      degrees: ((evtEnd - evtStart) / windowMs) * 360,
      // calendarId prefix prevents collisions when two providers use the same id value.
      eventId: `${evt.calendarId}:${evt.id}`,
    });
    cursor = evtEnd;
  }

  if (cursor < windowEnd) {
    slices.push({ color: gapColor, degrees: ((windowEnd - cursor) / windowMs) * 360 });
  }

  return slices;
}

/**
 * The full period an event ring covers for a given view, matching the
 * granularity of the background grid rings produced by `slicesForView`:
 *
 * - day   → the full 24-hour calendar day containing `now`
 * - week  → the full Mon–Sun week containing `now`
 * - month → the full calendar month containing `now`
 * - year  → the full calendar year containing `now`
 *
 * Exported so callers fetch exactly the range the ring will display — keeping
 * the cached `fetchedRange` aligned with this window so events register as
 * fetched rather than "unknown".
 */
export function eventWindow(view: TimeView, now: Date): TimeRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  let windowStart: number;
  let windowEnd: number;

  switch (view) {
    case "day": {
      windowStart = new Date(y, m, d).getTime();
      windowEnd = new Date(y, m, d + 1).getTime();
      break;
    }
    case "week": {
      // Monday-anchored: JS getDay() Sun=0 → offset 6; Mon=1 → offset 0.
      const jsDay = now.getDay();
      const offset = jsDay === 0 ? 6 : jsDay - 1;
      windowStart = new Date(y, m, d - offset).getTime();
      windowEnd = new Date(y, m, d - offset + 7).getTime();
      break;
    }
    case "month": {
      windowStart = new Date(y, m, 1).getTime();
      windowEnd = new Date(y, m + 1, 1).getTime();
      break;
    }
    case "year": {
      windowStart = new Date(y, 0, 1).getTime();
      windowEnd = new Date(y + 1, 0, 1).getTime();
      break;
    }
  }

  return {
    start: new Date(windowStart).toISOString(),
    end: new Date(windowEnd).toISOString(),
  };
}

export interface EventSlicesOptions {
  /** Events from the cache (may span multiple calendars). */
  events: CalendarEvent[];
  /** The time range that has been fetched, or null if never fetched. */
  fetchedRange: TimeRange | null;
  /** The active view granularity. */
  view: TimeView;
  /** The reference instant (typically Date.now()). */
  now: Date;
  /** Outer diameter of the produced ring; lets callers stack calendars. */
  size?: number;
  /** Stroke width of the produced ring. */
  lineWidth?: number;
}

/**
 * Produces an event-overlay `RingConfig[]` for use alongside the background
 * time rings from `slicesForView`.
 *
 * Returns a single inner ring whose slices represent events within the
 * "current unit" of the view (current hour for day, today for week/month,
 * current month for year). This sits inside the MultiCircle alongside the
 * existing background rings.
 */
export function eventSlicesForView({
  events,
  fetchedRange,
  view,
  now,
  size = 140,
  lineWidth = 12,
}: EventSlicesOptions): RingConfig {
  const window = eventWindow(view, now);
  const windowStart = new Date(window.start).getTime();
  const windowEnd = new Date(window.end).getTime();

  const isFetched =
    fetchedRange != null &&
    new Date(fetchedRange.start).getTime() <= windowStart &&
    new Date(fetchedRange.end).getTime() >= windowEnd;

  const overlapping = events.filter((e) => {
    const { start, end } = eventInterval(e);
    return end > windowStart && start < windowEnd;
  });

  const slices = eventsToSlices(overlapping, windowStart, windowEnd, isFetched);

  // Fallback: full unknown ring when no slices produced (empty window).
  if (slices.length === 0) {
    slices.push({
      color: isFetched ? EVENT_COLORS.free : EVENT_COLORS.unknown,
      degrees: 360,
    });
  }

  return { slices, lineWidth, size };
}
