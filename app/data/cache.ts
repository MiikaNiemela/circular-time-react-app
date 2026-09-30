import type { CalendarEvent, TimeRange } from "./types";

/** A cached fetch result for one calendar over one time range. */
export interface CacheEntry {
  /** The provider/calendar these events belong to. */
  calendarId: string;
  /** The range that was fetched. */
  range: TimeRange;
  /** Events returned for that range. */
  events: CalendarEvent[];
  /** ISO timestamp of when the fetch completed. */
  fetchedAt: string;
}

/** Minimal subset of the Web Storage API the cache depends on. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
