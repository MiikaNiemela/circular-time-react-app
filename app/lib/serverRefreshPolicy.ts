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
  return events.filter((event) => eventOverlaps(event, range));
}

function eventOverlaps(event: CalendarEvent, range: TimeRange): boolean {
  const rangeStart = new Date(range.start).getTime();
  const rangeEnd = new Date(range.end).getTime();
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();
  if (end === start) return start >= rangeStart && start < rangeEnd;
  return start < rangeEnd && end > rangeStart;
}

/** One month's events as fetched from the provider at `fetchedAt`. */
export interface FetchedWindow {
  range: TimeRange;
  fetchedAt: string;
  events: CalendarEvent[];
}

function sameEvent(a: CalendarEvent, b: CalendarEvent): boolean {
  return (
    a.title === b.title &&
    a.start === b.start &&
    a.end === b.end &&
    a.color === b.color &&
    (a.allDay ?? false) === (b.allDay ?? false)
  );
}

function fetchedAtMs(window: FetchedWindow): number {
  return new Date(window.fetchedAt).getTime();
}

/**
 * Returns the indexes of windows holding an event copy that a more recently
 * fetched window contradicts. The newer window overlaps the copy's time span
 * but holds a different version of the event, or no longer holds it at all.
 * This happens to an event spanning a month boundary when one month is
 * frozen as past while the other is refetched.
 */
export function contradictedWindows(windows: FetchedWindow[]): number[] {
  const byId = windows.map((w) => new Map(w.events.map((e) => [e.id, e])));
  const contradicted: number[] = [];
  windows.forEach((window, i) => {
    const isContradicted = window.events.some((event) =>
      windows.some((newer, j) => {
        if (fetchedAtMs(newer) <= fetchedAtMs(window)) return false;
        if (!eventOverlaps(event, newer.range)) return false;
        const other = byId[j].get(event.id);
        return !other || !sameEvent(other, event);
      })
    );
    if (isContradicted) contradicted.push(i);
  });
  return contradicted;
}

/**
 * Merges month windows into one event list. Each event appears once, as its
 * most recently fetched copy (on a tie, the earlier month's copy). That copy is
 * dropped when a window fetched later overlaps its time span and no longer
 * holds the event, because the provider deleted or moved it since. Events keep
 * the order of their windows and of the provider within a window.
 */
export function mergeWindows(windows: FetchedWindow[]): CalendarEvent[] {
  const latest = new Map<string, number>();
  windows.forEach((window, i) => {
    for (const event of window.events) {
      const current = latest.get(event.id);
      if (current === undefined || fetchedAtMs(window) > fetchedAtMs(windows[current])) {
        latest.set(event.id, i);
      }
    }
  });
  const ids = windows.map((w) => new Set(w.events.map((e) => e.id)));

  const merged: CalendarEvent[] = [];
  windows.forEach((window, i) => {
    for (const event of window.events) {
      if (latest.get(event.id) !== i) continue;
      const removedLater = windows.some(
        (newer, j) =>
          fetchedAtMs(newer) > fetchedAtMs(window) &&
          eventOverlaps(event, newer.range) &&
          !ids[j].has(event.id)
      );
      if (!removedLater) merged.push(event);
    }
  });
  return merged;
}
