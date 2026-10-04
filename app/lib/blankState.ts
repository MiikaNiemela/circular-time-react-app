/**
 * Why the timeline has nothing to show, and what the user can do about it.
 */
import type { CalendarFailure } from "./calendarReader";
import type { CalendarEventData } from "./calendarTimeline";
import type { TimeRange } from "../data/types";
import { eventInterval } from "../data/eventSlices";

/** A calendar the loader could not read, and why. */
export interface FailedCalendar {
  calendarId: string;
  reason: CalendarFailure;
}

export type BlankState =
  /** The account has no calendar connections. */
  | { kind: "no-sources" }
  /** Calendars are connected, but the user has hidden all of them. */
  | { kind: "all-hidden" }
  /** Visible calendars whose credentials must be renewed by connecting again. */
  | { kind: "reconnect"; calendarIds: string[] }
  /** A provider could not be reached and nothing is cached for this period. */
  | { kind: "unavailable"; calendarIds: string[] }
  /** Everything was read; the period simply has no events. */
  | { kind: "no-events" };

/** What {@link blankState} decides from. */
export interface BlankStateInput {
  /** How many calendars the account has connected. */
  connectedCount: number;
  /** The connected calendars the user has not hidden, with their events. */
  visible: CalendarEventData[];
  /** Calendars the loader could not read. */
  failures: FailedCalendar[];
  /** The period the view shows. */
  window: TimeRange;
}

/**
 * The state to explain, or null when there is nothing to explain. The first
 * case that applies wins:
 * 1. no calendars connected;
 * 2. all connected calendars hidden;
 * 3. a visible calendar needs reconnecting (shown even when other calendars
 *    have events, since its own events are missing);
 * 4. the period is blank because a provider was unavailable and nothing is
 *    cached for it;
 * 5. the period is blank and everything was read.
 */
export function blankState({
  connectedCount,
  visible,
  failures,
  window,
}: BlankStateInput): BlankState | null {
  if (connectedCount === 0) return { kind: "no-sources" };
  if (visible.length === 0) return { kind: "all-hidden" };

  const visibleIds = new Set(visible.map((c) => c.calendarId));
  const failed = (reason: CalendarFailure) =>
    failures
      .filter((f) => f.reason === reason && visibleIds.has(f.calendarId))
      .map((f) => f.calendarId);

  const reconnect = failed("reconnect-required");
  if (reconnect.length > 0) return { kind: "reconnect", calendarIds: reconnect };

  const start = new Date(window.start).getTime();
  const end = new Date(window.end).getTime();
  const hasEvents = visible.some((c) =>
    c.events.some((e) => {
      const interval = eventInterval(e);
      return interval.end > start && interval.start < end;
    })
  );
  if (hasEvents) return null;

  // Unavailable only explains a blank period when nothing is cached for it.
  const uncached = new Set(visible.filter((c) => c.fetchedRange === null).map((c) => c.calendarId));
  const unavailable = failed("unavailable").filter((id) => uncached.has(id));
  if (unavailable.length > 0) return { kind: "unavailable", calendarIds: unavailable };

  return { kind: "no-events" };
}
