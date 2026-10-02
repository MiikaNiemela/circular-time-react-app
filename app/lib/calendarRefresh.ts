/**
 * Background calendar refresh: brings every refreshable calendar connection's
 * near-future months up to date without a signed-in user or an open browser.
 *
 * The routine is independent of how it is triggered; a scheduler, a job, or
 * an endpoint calls {@link refreshCalendars} and reports its summary.
 */
import type { CalendarProvider } from "../data/types";
import { nearFutureRange } from "../data/refreshPolicy";
import { ReconnectRequiredError } from "./calendarCredentials";
import type { ServerEventCache } from "./serverEventCache";
import { ServerCalendarCache } from "./serverCalendarCache";
import type { CalendarConnection, OwnedCalendarConnection } from "./userRepository";

/** Why one connection could not be refreshed. */
export type RefreshFailureReason = "reconnect-required" | "unsupported-provider" | "provider-error";

/** The outcome of one background refresh run. */
export interface RefreshSummary {
  /** Connections with stored credentials that the run attempted. */
  attempted: number;
  /** Connections whose near-future months are now current. */
  refreshed: number;
  /** Connections that could not be refreshed, without user or token data. */
  failures: Array<{ calendarConnectionId: string; provider: string; reason: RefreshFailureReason }>;
}

/** Collaborators for {@link refreshCalendars}, injectable for tests. */
export interface CalendarRefreshDeps {
  listConnections: () => Promise<OwnedCalendarConnection[]>;
  cache: ServerEventCache;
  /** Builds a provider for the connection, or null for an unsupported provider. */
  providerFor: (userId: string, connection: CalendarConnection) => CalendarProvider | null;
  now?: () => Date;
}

/**
 * Refreshes each connection's near-future months through the server cache,
 * using the same refresh policy as page loads: missing months and stale
 * near-future months are fetched, fresh ones are left alone, and past months
 * are never refetched. Connections are processed one at a time, and a failure
 * in one never stops the others.
 */
export async function refreshCalendars(deps: CalendarRefreshDeps): Promise<RefreshSummary> {
  const now = deps.now ?? (() => new Date());
  const connections = await deps.listConnections();
  const summary: RefreshSummary = { attempted: connections.length, refreshed: 0, failures: [] };

  for (const connection of connections) {
    const fail = (reason: RefreshFailureReason) =>
      summary.failures.push({
        calendarConnectionId: connection.id,
        provider: connection.provider,
        reason,
      });

    try {
      const provider = deps.providerFor(connection.userId, connection);
      if (!provider) {
        fail("unsupported-provider");
        continue;
      }
      const reader = new ServerCalendarCache(
        provider,
        deps.cache,
        connection.userId,
        connection.id,
        now
      );
      await reader.fetchEvents(nearFutureRange(now()));
      summary.refreshed += 1;
    } catch (error: unknown) {
      fail(error instanceof ReconnectRequiredError ? "reconnect-required" : "provider-error");
    }
  }

  return summary;
}
