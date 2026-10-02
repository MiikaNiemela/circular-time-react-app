/**
 * A `CalendarProvider` wrapper that fronts a server-side event cache.
 * Requests are served from whole UTC calendar months; only stale or uncovered
 * months are fetched from the underlying provider.
 */
import type { CalendarProvider, CalendarEvent, TimeRange } from "../data/types";
import type { ServerEventCache } from "./serverEventCache";
import { shouldRefresh } from "../data/refreshPolicy";
import {
  contradictedWindows,
  eventsOverlapping,
  mergeWindows,
  monthlyWindowsCovering,
  type FetchedWindow,
} from "./serverRefreshPolicy";

/**
 * Wraps a `CalendarProvider` with an incremental server-side cache-aside policy.
 * The requested range is covered by whole UTC calendar months, so every view
 * shares the same cache keys. Each month is served from cache when fresh, or
 * fetched and cached independently when stale; the result is clipped to the
 * requested range.
 *
 * An event spanning a month boundary is held by both months, which can be
 * fetched at different times: a past month is never refreshed by the policy.
 * When a more recently fetched month contradicts a cached month's copy of an
 * event (a different version, or the event is gone), the cached month is
 * refetched once, so an edited or deleted event is not served from a frozen
 * month. Copies are then merged by fetch time (see {@link mergeWindows}).
 */
export class ServerCalendarCache implements CalendarProvider {
  constructor(
    private readonly provider: CalendarProvider,
    private readonly cache: ServerEventCache,
    private readonly userId: string,
    private readonly calendarConnectionId: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  get id(): string {
    return this.provider.id;
  }

  get name(): string {
    return this.provider.name;
  }

  async fetchEvents(range: TimeRange): Promise<CalendarEvent[]> {
    const windows: Array<FetchedWindow & { fromCache: boolean }> = [];

    for (const window of monthlyWindowsCovering(range)) {
      const cached = await this.cache.get(this.userId, this.provider.id, window);
      if (cached && !shouldRefresh(window, cached.fetchedAt, this.now())) {
        windows.push({ ...cached, range: window, fromCache: true });
      } else {
        windows.push({ ...(await this.fetchAndStore(window)), fromCache: false });
      }
    }

    for (const i of contradictedWindows(windows)) {
      if (windows[i].fromCache) {
        windows[i] = { ...(await this.fetchAndStore(windows[i].range)), fromCache: false };
      }
    }

    return eventsOverlapping(mergeWindows(windows), range);
  }

  private async fetchAndStore(window: TimeRange): Promise<FetchedWindow> {
    const events = await this.provider.fetchEvents(window);
    const fetchedAt = this.now().toISOString();
    await this.cache.set(this.userId, this.calendarConnectionId, {
      calendarId: this.provider.id,
      range: window,
      events,
      fetchedAt,
    });
    return { range: window, fetchedAt, events };
  }
}
