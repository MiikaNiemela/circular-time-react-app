/**
 * Reads one calendar connection's events for a range through the server-side
 * event cache, with the provider built from server-held credentials.
 */
import type { CalendarProvider, TimeRange } from "../data/types";
import type { CalendarEventData } from "./calendarTimeline";
import type { CalendarConnection } from "./userRepository";
import type { ServerEventCache } from "./serverEventCache";
import { ServerCalendarCache } from "./serverCalendarCache";
import { ReconnectRequiredError } from "./calendarCredentials";
import { ProviderHttpError } from "../data/providerErrors";
import {
  eventsOverlapping,
  mergeWindows,
  monthlyWindowsCovering,
  type FetchedWindow,
} from "./serverRefreshPolicy";

/**
 * Why a calendar could not be read:
 * - `reconnect-required`: its credentials are missing, expired, revoked or
 *   rejected; only the user can fix it, by connecting the calendar again.
 * - `unavailable`: any other failure (provider errors after retries, network,
 *   configuration); trying again later may work.
 */
export type CalendarFailure = "reconnect-required" | "unavailable";

/** The events to render for one calendar, and why reading it failed, if it did. */
export interface CalendarReadResult {
  calendar: CalendarEventData;
  failure: CalendarFailure | null;
}

/** Classifies a read failure. */
export function failureReason(error: unknown): CalendarFailure {
  if (error instanceof ReconnectRequiredError) return "reconnect-required";
  if (error instanceof ProviderHttpError && error.status === 401) return "reconnect-required";
  return "unavailable";
}

/** Collaborators for {@link readCalendar}, injectable for tests. */
export interface CalendarReaderDeps {
  cache: ServerEventCache;
  /** Builds a provider for the connection, or null for an unsupported provider. */
  providerFor: (userId: string, connection: CalendarConnection) => CalendarProvider | null;
  now?: () => Date;
}

/**
 * Serves whatever months are cached, merged by fetch time so that an event
 * spanning a month boundary appears as its most recently fetched copy. The
 * range is known only when every month is cached.
 */
async function cachedEvents(
  cache: ServerEventCache,
  userId: string,
  calendarId: string,
  range: TimeRange
): Promise<CalendarEventData> {
  const windows: FetchedWindow[] = [];
  let allCovered = true;
  for (const window of monthlyWindowsCovering(range)) {
    const entry = await cache.get(userId, calendarId, window);
    if (entry) windows.push({ range: window, fetchedAt: entry.fetchedAt, events: entry.events });
    else allCovered = false;
  }
  return {
    calendarId,
    events: eventsOverlapping(mergeWindows(windows), range),
    fetchedRange: allCovered ? range : null,
    cachedRanges: windows.map((w) => w.range),
  };
}

/**
 * Returns fresh events for the connection, fetching stale or missing months
 * from the provider. When the provider or its credentials fail, the cached
 * months are returned with the failure's reason, so the page can prompt a
 * reconnect, or offer to try again, without losing what it already knows.
 */
export async function readCalendar(
  deps: CalendarReaderDeps,
  userId: string,
  connection: CalendarConnection,
  range: TimeRange
): Promise<CalendarReadResult> {
  let failure: CalendarFailure = "unavailable";
  try {
    const provider = deps.providerFor(userId, connection);
    if (provider) {
      const reader = new ServerCalendarCache(provider, deps.cache, userId, connection.id, deps.now);
      const events = await reader.fetchEvents(range);
      return {
        calendar: { calendarId: connection.provider, events, fetchedRange: range },
        failure: null,
      };
    }
  } catch (error: unknown) {
    failure = failureReason(error);
    console.warn(`failed to refresh ${connection.provider} (${failure}):`, error);
  }
  return {
    calendar: await cachedEvents(deps.cache, userId, connection.provider, range),
    failure,
  };
}
