/**
 * A `CalendarProvider` wrapper that fronts a server-side event cache.
 * Splits requested ranges into monthly windows; only stale or uncovered windows
 * are fetched from the underlying provider.
 */
import type { CalendarProvider, CalendarEvent, TimeRange } from "../data/types";
import type { ServerEventCache } from "./serverEventCache";
import { shouldRefresh } from "../data/refreshPolicy";
import { splitIntoMonthlyWindows, deduplicateEvents } from "./serverRefreshPolicy";

/**
 * Wraps a `CalendarProvider` with an incremental server-side cache-aside policy.
 * The requested range is split into UTC-aligned monthly windows; each window is
 * served from cache when fresh, or fetched and cached independently when stale.
 */
export class ServerCalendarCache implements CalendarProvider {
  constructor(
    private readonly provider: CalendarProvider,
    private readonly cache: ServerEventCache,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  get id(): string {
    return this.provider.id;
  }

  get name(): string {
    return this.provider.name;
  }

  async fetchEvents(range: TimeRange): Promise<CalendarEvent[]> {
    const windows = splitIntoMonthlyWindows(range);
    const allEvents: CalendarEvent[] = [];

    for (const window of windows) {
      const cached = await this.cache.get(this.userId, this.provider.id, window);
      if (cached && !shouldRefresh(window, cached.fetchedAt, this.now())) {
        allEvents.push(...cached.events);
        continue;
      }
      const events = await this.provider.fetchEvents(window);
      await this.cache.set(this.userId, {
        calendarId: this.provider.id,
        range: window,
        events,
        fetchedAt: this.now().toISOString(),
      });
      allEvents.push(...events);
    }

    return deduplicateEvents(allEvents);
  }
}
