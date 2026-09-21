/**
 * Server-side helpers for incremental calendar event refresh.
 * Splits requested time ranges into monthly windows so the cache stores
 * and retrieves only the portions that are stale or uncovered, rather than
 * re-fetching the entire year on every request.
 */
import type { CalendarEvent, TimeRange } from "../data/types";

/** Re-exported so UI routes don't need to reach into the data layer. */
export { eventWindow } from "../data/eventSlices";

/**
 * Splits a TimeRange into one-month windows aligned to UTC month boundaries.
 * The first window starts at `range.start`; subsequent windows start at the
 * first of each calendar month; the last window ends at `range.end`.
 */
export function splitIntoMonthlyWindows(range: TimeRange): TimeRange[] {
  const windows: TimeRange[] = [];
  let cursor = new Date(range.start);
  const end = new Date(range.end);

  while (cursor < end) {
    const nextMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const windowEnd = nextMonth < end ? nextMonth : end;
    windows.push({ start: cursor.toISOString(), end: windowEnd.toISOString() });
    cursor = windowEnd;
  }

  return windows;
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
