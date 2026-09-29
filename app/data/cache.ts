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

export interface LocalCacheEntry extends CacheEntry {
  /** Immutable server-issued connection ID that owned the browser fetch. */
  calendarConnectionId: string;
}

/** Minimal subset of the Web Storage API the cache depends on. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = "circular-time-cache";

type Snapshot = Record<string, LocalCacheEntry>;

/**
 * The local cache is the source of truth the UI reads; network fetches refresh
 * it. It is keyed by `calendarId` so each provider keeps one latest entry.
 *
 * Persistence is injectable so the same logic runs against `localStorage` in
 * the browser and an in-memory map in tests. Past data is never discarded by
 * the cache itself — eviction, if ever needed, is an explicit caller decision.
 */
export class CalendarCache {
  private snapshot: Snapshot;

  constructor(private readonly storage: KeyValueStorage = defaultStorage()) {
    this.snapshot = this.load();
  }

  /**
   * Returns an entry only when it belongs to the active immutable connection.
   * Legacy rows and stale browser data are not safe to render after reconnect.
   */
  get(calendarId: string, calendarConnectionId: string): LocalCacheEntry | undefined {
    const entry = this.snapshot[calendarId];
    const hit = entry?.calendarConnectionId === calendarConnectionId;
    console.debug(`Cache lookup for calendarId=${calendarId}: ${hit ? "HIT" : "MISS"}`);
    return hit ? entry : undefined;
  }

  /** All cached entries, in insertion order. */
  entries(): LocalCacheEntry[] {
    return Object.values(this.snapshot);
  }

  /** Writes (or replaces) the entry for a calendar and persists. */
  set(entry: LocalCacheEntry): void {
    console.debug(`Cache update for calendarId=${entry.calendarId}`);
    this.snapshot[entry.calendarId] = entry;
    this.persist();
  }

  /** Removes a calendar's cached entry (e.g. on disconnect). */
  remove(calendarId: string): void {
    console.debug(`Cache remove for calendarId=${calendarId}`);
    delete this.snapshot[calendarId];
    this.persist();
  }

  /** Clears every entry. */
  clear(): void {
    console.debug("Cache cleared");
    this.snapshot = {};
    this.storage.removeItem(STORAGE_KEY);
  }

  private load(): Snapshot {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Snapshot) : {};
    } catch {
      // Corrupt cache should never crash the app — start fresh.
      return {};
    }
  }

  private persist(): void {
    console.debug("Cache persisted");
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
  }
}

/** In-memory fallback when no Web Storage is available (e.g. SSR). */
function defaultStorage(): KeyValueStorage {
  if (typeof localStorage !== "undefined") return localStorage;
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
