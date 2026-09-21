import type { PrismaClient } from "@prisma/client";
import type { CalendarEvent, TimeRange } from "../types";
import type { CacheEntry } from "../cache";

// Structural duck-typing — Data Layer must not import from Business Logic (enforced at the assignment in app/lib/serverEventCache.server.ts).
/** Prisma-backed implementation of the ServerEventCache interface. */
export class PrismaEventCacheRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Looks up a cached event range by user + calendar + exact range boundaries.
   * Returns `null` on a miss.
   */
  async get(userId: string, calendarId: string, range: TimeRange): Promise<CacheEntry | null> {
    const record = await this.db.cachedEventRange.findUnique({
      where: {
        userId_calendarId_rangeStart_rangeEnd: {
          userId,
          calendarId,
          rangeStart: range.start,
          rangeEnd: range.end,
        },
      },
    });
    if (!record) return null;
    return {
      calendarId: record.calendarId,
      range: { start: record.rangeStart, end: record.rangeEnd },
      events: JSON.parse(record.eventsJson) as CalendarEvent[],
      fetchedAt: record.fetchedAt.toISOString(),
    };
  }

  /**
   * Stores or replaces the cached event range for a user + calendar + range,
   * using an atomic upsert to handle concurrent writes safely.
   */
  async set(userId: string, entry: CacheEntry): Promise<void> {
    const eventsJson = JSON.stringify(entry.events);
    const fetchedAt = new Date(entry.fetchedAt);
    await this.db.cachedEventRange.upsert({
      where: {
        userId_calendarId_rangeStart_rangeEnd: {
          userId,
          calendarId: entry.calendarId,
          rangeStart: entry.range.start,
          rangeEnd: entry.range.end,
        },
      },
      update: { eventsJson, fetchedAt },
      create: {
        userId,
        calendarId: entry.calendarId,
        rangeStart: entry.range.start,
        rangeEnd: entry.range.end,
        eventsJson,
        fetchedAt,
      },
    });
  }
}
