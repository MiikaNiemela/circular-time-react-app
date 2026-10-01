/**
 * Wires {@link readCalendar} and {@link refreshCalendars} to the Prisma event
 * cache, the user store, and the encrypted credential store. Server-only.
 */
import type { TimeRange } from "../data/types";
import { GoogleCalendarProvider } from "../data/providers/google/GoogleCalendarProvider";
import { OutlookCalendarProvider } from "../data/providers/outlook/OutlookCalendarProvider";
import { readCalendar, type CalendarReadResult } from "./calendarReader";
import { refreshCalendars, type RefreshSummary } from "./calendarRefresh";
import { calendarCredentialStore, providerRefresher } from "./calendarCredentials.server";
import { serverEventCache } from "./serverEventCache.server";
import { userRepository } from "./userRepository.server";
import type { CalendarConnection } from "./userRepository";

function providerFor(userId: string, connection: CalendarConnection) {
  const provider = connection.provider;
  if (provider !== "google" && provider !== "outlook") return null;
  const accessToken = () =>
    calendarCredentialStore.accessToken(userId, connection.id, providerRefresher(provider));
  return provider === "google"
    ? new GoogleCalendarProvider({ accessToken })
    : new OutlookCalendarProvider({ accessToken });
}

/** Reads one of the user's calendar connections for the range. */
export function readCalendarEvents(
  userId: string,
  connection: CalendarConnection,
  range: TimeRange
): Promise<CalendarReadResult> {
  return readCalendar({ cache: serverEventCache, providerFor }, userId, connection, range);
}

/** Refreshes the near-future months of every connection with stored credentials. */
export function refreshAllCalendars(): Promise<RefreshSummary> {
  return refreshCalendars({
    listConnections: () => userRepository.listRefreshableCalendarConnections(),
    cache: serverEventCache,
    providerFor,
  });
}
