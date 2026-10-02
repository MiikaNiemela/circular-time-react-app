/**
 * Reads one calendar connection's events for a range through the server-side
 * event cache, with the provider built from server-held credentials.
 */
import type { CalendarProvider, CalendarEvent, TimeRange } from "../data/types";
import type { CalendarEventData } from "./calendarTimeline";
import type { CalendarConnection } from "./userRepository";
import type { ServerEventCache } from "./serverEventCache";
import { ServerCalendarCache } from "./serverCalendarCache";
import {
  deduplicateEvents,
  eventsOverlapping,
  monthlyWindowsCovering,
} from "./serverRefreshPolicy";

/** The events to render for one calendar, and whether reading it failed. */
export interface CalendarReadResult {
  calendar: CalendarEventData;
  failed: boolean;
}

/** Collaborators for {@link readCalendar}, injectable for tests. */
export interface CalendarReaderDeps {
  cache: ServerEventCache;
  /** Builds a provider for the connection, or null for an unsupported provider. */
  providerFor: (userId: string, connection: CalendarConnection) => CalendarProvider | null;
  now?: () => Date;
}

/** Serves whatever months are cached; the range is known only when all are. */
async function cachedEvents(
  cache: ServerEventCache,
  userId: string,
  calendarId: string,
  range: TimeRange
): Promise<CalendarEventData> {
  const events: CalendarEvent[] = [];
  let allCovered = true;
  for (const window of monthlyWindowsCovering(range)) {
    const entry = await cache.get(userId, calendarId, window);
    if (entry) events.push(...entry.events);
    else allCovered = false;
  }
  return {
    calendarId,
    events: eventsOverlapping(deduplicateEvents(events), range),
    fetchedRange: allCovered ? range : null,
  };
}

/**
 * Returns fresh events for the connection, fetching stale or missing months
 * from the provider. When the provider or its credentials fail, the cached
 * months are returned and the calendar is marked failed, so the page can
 * prompt a reconnect without losing what it already knows.
 */
export async function readCalendar(
  deps: CalendarReaderDeps,
  userId: string,
  connection: CalendarConnection,
  range: TimeRange
): Promise<CalendarReadResult> {
  try {
    const provider = deps.providerFor(userId, connection);
    if (provider) {
      const reader = new ServerCalendarCache(provider, deps.cache, userId, connection.id, deps.now);
      const events = await reader.fetchEvents(range);
      return {
        calendar: { calendarId: connection.provider, events, fetchedRange: range },
        failed: false,
      };
    }
  } catch (error: unknown) {
    console.warn(`failed to refresh ${connection.provider}:`, error);
  }
  return {
    calendar: await cachedEvents(deps.cache, userId, connection.provider, range),
    failed: true,
  };
}
