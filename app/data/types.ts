/**
 * Data layer contracts shared by every calendar provider and the local cache.
 *
 * This module is the boundary the UI never crosses directly: routes and
 * components read from the cache (the source of truth), while providers refresh
 * it from the network. Keeping these types provider-agnostic lets Google,
 * Outlook, and iCal implementations vary without leaking into the UI.
 */

/** A half-open instant range `[start, end)`, both ISO 8601 strings (UTC). */
export interface TimeRange {
  /** Inclusive start, ISO 8601. */
  start: string;
  /** Exclusive end, ISO 8601. */
  end: string;
}

/** A single calendar event, normalised across providers. */
export interface CalendarEvent {
  /** Stable id, unique within its source calendar. */
  id: string;
  /** Id of the calendar/provider this event belongs to. */
  calendarId: string;
  /** Human-readable title. */
  title: string;
  /** Event start, ISO 8601. */
  start: string;
  /** Event end, ISO 8601. */
  end: string;
  /** Optional display colour (provider- or calendar-assigned). */
  color?: string;
  /** Whether this is an all-day event. */
  allDay?: boolean;
}

/**
 * Common interface every calendar source implements.
 *
 * Providers are pure data sources: given a time range they return events.
 * Auth, caching, and refresh orchestration live above this interface so each
 * concrete provider stays focused on talking to its backend.
 */
export interface CalendarProvider {
  /** Stable identifier, e.g. `"google"`, `"outlook"`, `"ical"`. */
  readonly id: string;
  /** Display name shown in settings. */
  readonly name: string;
  /**
   * Fetch events overlapping `range` from the underlying calendar.
   * Implementations should return events whose `[start, end)` intersects the
   * requested range.
   */
  fetchEvents(range: TimeRange): Promise<CalendarEvent[]>;
}
