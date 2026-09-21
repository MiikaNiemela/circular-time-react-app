import type { KeyValueStorage } from "./cache";

/**
 * Persisted per-calendar visibility preferences.
 *
 * A connected calendar is shown on the timeline by default; this store only
 * records explicit *hides*, so a freshly-connected calendar appears without
 * needing a stored entry. Toggling a calendar off in Settings persists here so
 * the choice survives reloads — the gap that made the Settings toggles
 * previously ephemeral.
 *
 * Visibility is independent of authentication: a calendar renders only when it
 * is both visible (here) and connected (a token exists). This store knows
 * nothing about tokens.
 */
const STORAGE_KEY = "circular-time-calendar-visibility";

type VisibilityMap = Record<string, boolean>;

export class CalendarVisibilityStore {
  constructor(private readonly storage: KeyValueStorage = defaultStorage()) {}

  /** Whether a calendar should render. Defaults to `true` when never set. */
  isVisible(calendarId: string): boolean {
    return this.load()[calendarId] ?? true;
  }

  /** Persists a calendar's visibility. */
  setVisible(calendarId: string, visible: boolean): void {
    const map = this.load();
    map[calendarId] = visible;
    this.storage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  /** The full map of explicit preferences (absent ids default to visible). */
  all(): VisibilityMap {
    return this.load();
  }

  private load(): VisibilityMap {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as VisibilityMap) : {};
    } catch {
      return {};
    }
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
