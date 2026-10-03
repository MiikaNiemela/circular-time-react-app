import { useState, useSyncExternalStore } from "react";

/** How often the current time is refreshed. */
const TICK_MS = 15_000;

/** A clock that starts ticking when React subscribes to it. */
function createClock() {
  let now: number | null = null;
  return {
    subscribe(onChange: () => void) {
      now = Date.now();
      const id = setInterval(() => {
        now = Date.now();
        onChange();
      }, TICK_MS);
      return () => clearInterval(id);
    },
    snapshot: () => now,
  };
}

/**
 * The current time, refreshed every 15 seconds. It is null on the server and
 * during hydration, so server-rendered markup never depends on the server's
 * clock or time zone.
 */
export function useNow(): Date | null {
  const [clock] = useState(createClock);
  const ms = useSyncExternalStore(clock.subscribe, clock.snapshot, () => null);
  return ms === null ? null : new Date(ms);
}
