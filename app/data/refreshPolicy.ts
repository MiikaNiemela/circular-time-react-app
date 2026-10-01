import type { TimeRange } from "./types";

/** One calendar day in milliseconds. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long a near-future range stays fresh after a successful fetch. Within
 * this time it is served from the cache, so repeated page loads, and views
 * that share a month, do not each call the provider.
 */
export const NEAR_FUTURE_FRESH_FOR_MS = 15 * 60 * 1000;

/**
 * Decides whether a cached time range should be refreshed from the network.
 *
 * The policy encodes the app's data rules:
 * - **Unknown periods** (never fetched) always refresh — there is nothing to
 *   show otherwise.
 * - **Past data is never auto-discarded or auto-refreshed.** A range that ends
 *   at or before `now` is only refreshed on explicit user action, so this
 *   returns `false` for it.
 * - **Near-future data refreshes automatically.** If the range extends into the
 *   future and any part of it falls within one calendar day from `now`, it
 *   refreshes once its last fetch is at least {@link NEAR_FUTURE_FRESH_FOR_MS}
 *   old, so freshly-added events appear on open.
 * - **Far-future data** that is already cached is left as-is until the
 *   near-future window catches up to it.
 *
 * @param range        The time range being displayed.
 * @param lastFetchedAt ISO timestamp of the last successful fetch for this
 *                      range, or `null`/`undefined` if never fetched.
 * @param now          The current instant.
 */
export function shouldRefresh(
  range: TimeRange,
  lastFetchedAt: string | null | undefined,
  now: Date
): boolean {
  // Unknown period: nothing cached, must fetch.
  if (lastFetchedAt == null) return true;

  const nowMs = now.getTime();
  const rangeEnd = new Date(range.end).getTime();

  // Entirely in the past: manual refresh only.
  if (rangeEnd <= nowMs) return false;

  // The range reaches into the future. Auto-refresh when part of it lies within
  // the next calendar day and the cached copy has outlived its freshness.
  const rangeStart = new Date(range.start).getTime();
  const nearFutureCutoff = nowMs + ONE_DAY_MS;
  const touchesNearFuture = rangeStart < nearFutureCutoff;
  if (!touchesNearFuture) return false;

  return nowMs - new Date(lastFetchedAt).getTime() >= NEAR_FUTURE_FRESH_FOR_MS;
}

/**
 * The part of the timeline the near-future rule refreshes automatically:
 * from `now` to one day ahead. A background refresh keeps this range warm.
 */
export function nearFutureRange(now: Date): TimeRange {
  return {
    start: now.toISOString(),
    end: new Date(now.getTime() + ONE_DAY_MS).toISOString(),
  };
}
