/**
 * Server-side event cache contract for persisting calendar event ranges in the
 * backend database, shared across devices and sessions for the same user.
 */
import type { TimeRange } from "../data/types";
import type { CacheEntry } from "../data/cache";

/**
 * Reads and writes cached calendar event ranges, keyed by user + calendar + range.
 * The concrete implementation stores entries in the backend database.
 */
export interface ServerEventCache {
  /** Returns the cached entry for a user + calendar + range, or `null` on miss. */
  get(userId: string, calendarId: string, range: TimeRange): Promise<CacheEntry | null>;
  /** Stores or replaces the cached entry for a user + calendar + range. */
  set(userId: string, entry: CacheEntry): Promise<void>;
}
