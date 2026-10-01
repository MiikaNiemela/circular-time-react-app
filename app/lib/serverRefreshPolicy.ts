/**
 * Server-side helpers for incremental calendar event refresh.
 * The server cache stores whole UTC calendar months, so every view and the
 * background refresh read and write the same cache keys, and a request only
 * fetches the months that are stale or missing.
 */
import type { CalendarEvent, TimeRange } from "../data/types";

/** Re-exported so UI routes don't need to reach into the data layer. */
export { eventWindow } from "../data/eventSlices";

/**
 * Returns the whole UTC calendar months that cover a TimeRange, in order.
 * The first window starts on the first of the month containing `range.start`;
 * the last window ends on the first of the month after the one containing the
 * last instant before `range.end`. Windows are contiguous.
 */
export function monthlyWindowsCovering(range: TimeRange): TimeRange[] {
  const windows: TimeRange[] = [];
  const start = new Date(range.start);
  const end = new Date(range.end);
  if (end <= start) return windows;
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  while (cursor < end) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    windows.push({ start: cursor.toISOString(), end: next.toISOString() });
    cursor = next;
  }

  return windows;
}

/**
 * Keeps the events whose half-open `[start, end)` interval intersects the
 * range. A zero-length event is kept when its instant lies inside the range.
 */
export function eventsOverlapping(events: CalendarEvent[], range: TimeRange): CalendarEvent[] {
  const rangeStart = new Date(range.start).getTime();
  const rangeEnd = new Date(range.end).getTime();
  return events.filter((event) => {
    const start = new Date(event.start).getTime();
    const end = new Date(event.end).getTime();
    if (end === start) return start >= rangeStart && start < rangeEnd;
    return start < rangeEnd && end > rangeStart;
  });
}

/**
 * Removes duplicate calendar events by `id`, keeping the first occurrence.
 * Needed when monthly windows are merged and a multi-day event was returned
 * by fetches for more than one window.
 */
export function deduplicateEvents(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}
