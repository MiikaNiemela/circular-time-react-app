import type { TimeRange } from "./types";

/** One calendar day in milliseconds. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
 *   refreshes so freshly-added events appear on open.
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
  // the next calendar day.
  const rangeStart = new Date(range.start).getTime();
  const nearFutureCutoff = nowMs + ONE_DAY_MS;
  const touchesNearFuture = rangeStart < nearFutureCutoff;

  return touchesNearFuture;
}
