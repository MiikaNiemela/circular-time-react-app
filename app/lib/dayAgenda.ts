/**
 * The day agenda: the shown day's timed events in order, with what is past,
 * what is up next, and which events run over the day's edges.
 */
import type { CalendarEvent, TimeRange } from "../data/types";
import { EVENT_COLORS } from "../data/eventSlices";
import { isDayLong } from "./allDay";

/** One row of the day agenda. */
export interface AgendaItem {
  /** `calendarId:id`, the same key the event's ring slice uses. */
  key: string;
  event: CalendarEvent;
  /** Start within the shown day, 24-hour `HH:MM`: 00:00 if it began earlier. */
  time: string;
  /** Colour of the event's slice. */
  color: string;
  /** The event began before the shown day. */
  startedEarlier: boolean;
  /** The event runs past the end of the shown day. */
  endsLater: boolean;
  /** Ended before now (only when the shown day is today). */
  past: boolean;
  /** The first event that starts after now (only when the shown day is today). */
  upNext: boolean;
}

/**
 * Builds the agenda for `day`. Timed events that overlap the day are listed by
 * start, then end, then key. `now` is the current time, or null when the
 * shown day is not today, in which case nothing is past or up next.
 */
export function dayAgenda(
  events: CalendarEvent[],
  day: TimeRange,
  now: Date | null,
  locale?: string
): AgendaItem[] {
  const dayStart = new Date(day.start).getTime();
  const dayEnd = new Date(day.end).getTime();
  const nowMs = now?.getTime();
  const formatTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const rows = events
    .filter((e) => !e.allDay && !isDayLong(e, day))
    .map((event) => ({
      event,
      key: `${event.calendarId}:${event.id}`,
      start: new Date(event.start).getTime(),
      end: new Date(event.end).getTime(),
    }))
    .filter((r) => r.end > dayStart && r.start < dayEnd)
    .sort(
      (a, b) => a.start - b.start || a.end - b.end || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
    );

  const nextKey = nowMs === undefined ? undefined : rows.find((r) => r.start > nowMs)?.key;

  return rows.map((r) => ({
    key: r.key,
    event: r.event,
    time: formatTime.format(new Date(Math.max(r.start, dayStart))),
    color: r.event.color ?? EVENT_COLORS.event,
    startedEarlier: r.start < dayStart,
    endsLater: r.end > dayEnd,
    past: nowMs !== undefined && r.end <= nowMs,
    upNext: r.key === nextKey,
  }));
}
