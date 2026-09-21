/**
 * Orchestration hook that loads and refreshes calendar events for the timeline.
 *
 * The local cache is the source of truth for optimistic rendering; the server
 * DB cache is the durable store. When `enabled` is true the hook fetches from
 * APIs (using browser tokens), writes to localStorage, and calls `onFetched` so
 * the caller can warm the server-side DB cache. Pass `enabled: false` when the
 * server has already provided fresh data — the hook becomes a no-op.
 */

import { useEffect, useRef, useState } from "react";
import type { TimeView } from "../components/SegmentedControl";
import {
  CalendarCache,
  CalendarVisibilityStore,
  eventWindow,
  shouldRefresh,
  type CalendarProvider,
  type TimeRange,
} from "../data";
import { GoogleCalendarProvider, GoogleTokenStore } from "../data/providers/google";
import { GOOGLE_CLIENT_ID } from "../data/providers/google/config";
import { OutlookCalendarProvider, OutlookTokenStore } from "../data/providers/outlook";
import { OUTLOOK_CLIENT_ID } from "../data/providers/outlook/config";
import type { CalendarEventData } from "./calendarTimeline";
import type { CacheEntry } from "../data/cache";

/** Re-exported so UI routes don't need to reach into the data layer. */
export type { CacheEntry };

/**
 * Describes a calendar source the timeline can render: how to tell whether it
 * is connected, and how to build a provider to fetch from it. Adding iCal
 * (Milestone 3.5) is a matter of appending an entry here.
 */
interface ProviderEntry {
  id: string;
  isConnected: () => boolean;
  create: () => CalendarProvider;
}

const PROVIDERS: ProviderEntry[] = [
  {
    id: "google",
    isConnected: () => new GoogleTokenStore().get() != null,
    create: () => new GoogleCalendarProvider({ clientId: GOOGLE_CLIENT_ID }),
  },
  {
    id: "outlook",
    isConnected: () => new OutlookTokenStore().get() != null,
    create: () => new OutlookCalendarProvider({ clientId: OUTLOOK_CLIENT_ID }),
  },
];

/** Snapshot of event data and fetch health returned by {@link useCalendarTimeline}. */
export interface CalendarTimelineResult {
  /** One entry per connected, visible calendar in provider-registration order. */
  calendars: CalendarEventData[];
  /** Provider IDs whose most recent fetch threw; empty when all calendars succeeded. */
  failedCalendars: string[];
}

/** Whether `inner` is fully contained within `outer`. */
function covers(outer: TimeRange | undefined, inner: TimeRange): boolean {
  if (!outer) return false;
  return (
    new Date(outer.start).getTime() <= new Date(inner.start).getTime() &&
    new Date(outer.end).getTime() >= new Date(inner.end).getTime()
  );
}

/** Options for {@link useCalendarTimeline}. */
export interface UseCalendarTimelineOptions {
  /**
   * When false, no fetching occurs and an empty result is returned immediately.
   * Pass false when the server already has fresh data so the hook acts as a no-op.
   */
  enabled?: boolean;
  /**
   * Called after each calendar's events are successfully fetched and written to
   * the local cache. Use this to warm the server-side DB cache via an action.
   */
  onFetched?: (entry: CacheEntry) => void;
}

/**
 * Loads events for every connected, visible calendar and keeps them in sync
 * with the active view; failed fetches are reported via `failedCalendars` so
 * the caller can surface reconnect prompts. Pass `enabled: false` to suppress
 * all fetching (e.g. when the server has already provided the data).
 */
export function useCalendarTimeline(
  view: TimeView,
  reference: Date | null,
  options: UseCalendarTimelineOptions = {}
): CalendarTimelineResult {
  const [data, setData] = useState<CalendarEventData[]>([]);
  const [failedCalendars, setFailedCalendars] = useState<string[]>([]);
  // The window follows the browsed reference; the refresh policy's notion of
  // "past vs future" stays anchored to the real clock. Null until the reference
  // resolves post-hydration — the effect no-ops until then.
  const referenceMs = reference?.getTime() ?? null;
  const { enabled = true } = options;

  // Stable ref so the effect always calls the latest callback without adding it
  // to the dependency array (which would re-trigger fetches on every render).
  const onFetchedRef = useRef(options.onFetched);
  useEffect(() => {
    onFetchedRef.current = options.onFetched;
  });

  useEffect(() => {
    if (referenceMs === null || !enabled) return;
    let cancelled = false;
    const now = new Date();
    const visibility = new CalendarVisibilityStore();
    const cache = new CalendarCache();
    const range = eventWindow(view, new Date(referenceMs));

    const active = PROVIDERS.filter((p) => p.isConnected() && visibility.isVisible(p.id));

    async function run() {
      const newFailures: string[] = [];
      const results = await Promise.all(
        active.map(async (entry): Promise<CalendarEventData> => {
          const cached = cache.get(entry.id);
          let events = cached?.events ?? [];
          let fetchedRange: TimeRange | null = covers(cached?.range, range) ? cached!.range : null;

          const stale =
            !covers(cached?.range, range) || shouldRefresh(range, cached?.fetchedAt, now);

          if (stale) {
            console.debug(`calendar events stale, refreshing ${entry.id} for ${view} view...`);
            try {
              events = await entry.create().fetchEvents(range);
              fetchedRange = range;
              const cacheEntry: CacheEntry = {
                calendarId: entry.id,
                range,
                events,
                fetchedAt: now.toISOString(),
              };
              cache.set(cacheEntry);
              onFetchedRef.current?.(cacheEntry);
            } catch (err) {
              newFailures.push(entry.id);
              // Keep cached data (possibly empty) on a failed refresh.
              console.warn(`failed to refresh ${entry.id}:`, err);
            }
          }

          return { calendarId: entry.id, events, fetchedRange };
        })
      );
      console.debug(`loaded events for ${results.length} calendars`);
      if (!cancelled) {
        setData(results);
        setFailedCalendars(newFailures);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [view, referenceMs, enabled]);
  return { calendars: data, failedCalendars };
}
