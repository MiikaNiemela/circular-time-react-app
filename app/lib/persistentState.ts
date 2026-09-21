/**
 * Client-only UI state backed by localStorage, exposed through
 * useSyncExternalStore so the server and client renders agree during hydration
 * without a setState-in-effect (which eslint-plugin-react-hooks flags as a
 * cascading-render hazard).
 *
 * Each hook returns its server default during SSR and the first client render,
 * then the real stored value once hydration completes — React swaps snapshots
 * without a mismatch error. Writes persist immediately and notify same-tab
 * subscribers (the native `storage` event only fires in other tabs).
 */

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function persist(key: string, value: string): void {
  localStorage.setItem(key, value);
  for (const notify of listeners) notify();
}

const REFERENCE_KEY = "circular-time-reference-date";

// useSyncExternalStore requires getSnapshot to return a referentially stable
// value while the store is unchanged; cache the parsed Date so repeated reads
// don't allocate a new object every render (which would loop forever).
let referenceCache: { iso: string | null; date: Date } | null = null;

function referenceSnapshot(): Date {
  const iso = localStorage.getItem(REFERENCE_KEY);
  if (!referenceCache || referenceCache.iso !== iso) {
    referenceCache = { iso, date: iso ? new Date(iso) : new Date() };
  }
  return referenceCache.date;
}

// No reference exists on the server; `null` defers all date-derived geometry to
// the client so hydration matches the empty server markup.
const referenceServerSnapshot = (): Date | null => null;

/**
 * The browsed reference date, persisted across reloads; `null` until hydration
 * resolves it on the client, then the stored date (or today, if none stored).
 */
export function useReferenceDate(): [Date | null, (date: Date) => void] {
  const reference = useSyncExternalStore(subscribe, referenceSnapshot, referenceServerSnapshot);
  const setReference = useCallback((date: Date) => persist(REFERENCE_KEY, date.toISOString()), []);
  return [reference, setReference];
}

const TIME_LAPSE_KEY = "circular-time-show-time-lapse";

function timeLapseSnapshot(): boolean {
  return localStorage.getItem(TIME_LAPSE_KEY) === "true";
}

const timeLapseServerSnapshot = (): boolean => false;

/**
 * Whether the background time-lapse ring is shown, persisted across reloads;
 * `false` until hydration, then the stored preference.
 */
export function useShowTimeLapse(): [boolean, (show: boolean) => void] {
  const show = useSyncExternalStore(subscribe, timeLapseSnapshot, timeLapseServerSnapshot);
  const setShow = useCallback((value: boolean) => persist(TIME_LAPSE_KEY, String(value)), []);
  return [show, setShow];
}
