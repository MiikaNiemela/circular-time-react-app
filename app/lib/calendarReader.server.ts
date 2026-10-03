/**
 * Wires {@link readCalendar} and {@link refreshCalendars} to the Prisma event
 * cache, the user store, and the encrypted credential store. Server-only.
 */
import type { TimeRange } from "../data/types";
import { GoogleCalendarProvider } from "../data/providers/google/GoogleCalendarProvider";
import { OutlookCalendarProvider } from "../data/providers/outlook/OutlookCalendarProvider";
import {
  BACKGROUND_RETRY,
  INTERACTIVE_RETRY,
  type RetryOptions,
} from "../data/providers/retryingFetch";
import { readCalendar, type CalendarReadResult } from "./calendarReader";
import { refreshCalendars, type RefreshSummary } from "./calendarRefresh";
import { calendarCredentialStore, providerRefresher } from "./calendarCredentials.server";
import { serverEventCache } from "./serverEventCache.server";
import { userRepository } from "./userRepository.server";
import type { CalendarConnection } from "./userRepository";

/** Builds a provider whose requests retry under `retry`. */
const providerWith = (retry: RetryOptions) => (userId: string, connection: CalendarConnection) => {
  const provider = connection.provider;
  if (provider !== "google" && provider !== "outlook") return null;
  const accessToken = () =>
    calendarCredentialStore.accessToken(userId, connection.id, providerRefresher(provider));
  return provider === "google"
    ? new GoogleCalendarProvider({ accessToken, retry })
    : new OutlookCalendarProvider({ accessToken, retry });
};

/** Reads one of the user's calendar connections for the range. */
export function readCalendarEvents(
  userId: string,
  connection: CalendarConnection,
  range: TimeRange
): Promise<CalendarReadResult> {
  return readCalendar(
    { cache: serverEventCache, providerFor: providerWith(INTERACTIVE_RETRY) },
    userId,
    connection,
    range
  );
}

/** Refreshes the near-future months of every connection with stored credentials. */
export function refreshAllCalendars(): Promise<RefreshSummary> {
  return refreshCalendars({
    listConnections: () => userRepository.listRefreshableCalendarConnections(),
    cache: serverEventCache,
    providerFor: providerWith(BACKGROUND_RETRY),
  });
}
