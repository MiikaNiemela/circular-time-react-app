/**
 * Composes the timeline's event rings from per-calendar cached events.
 *
 * One ring per visible, connected calendar, nested concentrically inside the
 * background time-grid rings produced by `slicesForView`. Calendars are drawn
 * from outermost to innermost in the order given, each ring stepped inward so
 * they don't overlap.
 *
 * This module is pure: it takes already-fetched events and produces ring
 * configs. Fetching, caching, and auth live in the orchestration hook.
 */

import type { RingConfig } from "../components/timeline";
import type { CalendarEvent, TimeRange } from "../data";
import { eventSlicesForView } from "../data";
import type { TimeView } from "../components/SegmentedControl";

export type { CalendarEvent };

/** Per-calendar events plus the range fetched for them. */
export interface CalendarEventData {
  calendarId: string;
  events: CalendarEvent[];
  /** Range fetched for this calendar, or null if never fetched. */
  fetchedRange: TimeRange | null;
}

/** Outermost event ring sits just inside the inner background ring (size 200). */
const FIRST_EVENT_RING_SIZE = 168;
/** Each subsequent calendar steps inward by ring thickness + a small gap. */
const RING_STEP = 24;
const EVENT_RING_LINE_WIDTH = 12;
/** Don't shrink rings below this — keeps inner calendars legible. */
const MIN_RING_SIZE = 48;

/**
 * Builds one event ring per calendar, ordered as given (outermost first).
 *
 * Returns an empty array when no calendars are supplied, so the caller renders
 * the background rings alone.
 */
export function eventRingsForCalendars(
  calendars: CalendarEventData[],
  view: TimeView,
  now: Date
): RingConfig[] {
  return calendars.map((cal, index) => {
    const size = Math.max(MIN_RING_SIZE, FIRST_EVENT_RING_SIZE - index * RING_STEP);
    return eventSlicesForView({
      events: cal.events,
      fetchedRange: cal.fetchedRange,
      view,
      now,
      size,
      lineWidth: EVENT_RING_LINE_WIDTH,
    });
  });
}
