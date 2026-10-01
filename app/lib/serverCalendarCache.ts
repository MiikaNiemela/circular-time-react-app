/**
 * A `CalendarProvider` wrapper that fronts a server-side event cache.
 * Requests are served from whole UTC calendar months; only stale or uncovered
 * months are fetched from the underlying provider.
 */
import type { CalendarProvider, CalendarEvent, TimeRange } from "../data/types";
import type { ServerEventCache } from "./serverEventCache";
import { shouldRefresh } from "../data/refreshPolicy";
import {
  deduplicateEvents,
  eventsOverlapping,
  monthlyWindowsCovering,
} from "./serverRefreshPolicy";

/**
 * Wraps a `CalendarProvider` with an incremental server-side cache-aside policy.
 * The requested range is covered by whole UTC calendar months, so every view
 * shares the same cache keys. Each month is served from cache when fresh, or
 * fetched and cached independently when stale; the result is clipped to the
 * requested range.
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
    const allEvents: CalendarEvent[] = [];

    for (const window of monthlyWindowsCovering(range)) {
      const cached = await this.cache.get(this.userId, this.provider.id, window);
      if (cached && !shouldRefresh(window, cached.fetchedAt, this.now())) {
        allEvents.push(...cached.events);
        continue;
      }
      allEvents.push(...(await this.fetchAndStore(window)));
    }

    return eventsOverlapping(deduplicateEvents(allEvents), range);
  }

  private async fetchAndStore(window: TimeRange): Promise<CalendarEvent[]> {
    const events = await this.provider.fetchEvents(window);
    await this.cache.set(this.userId, this.calendarConnectionId, {
      calendarId: this.provider.id,
      range: window,
      events,
      fetchedAt: this.now().toISOString(),
    });
    return events;
  }
}
