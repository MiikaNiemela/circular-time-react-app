/**
 * Pure date arithmetic for browsing the timeline between periods (Milestone 4.1).
 *
 * The timeline renders the period *containing* a reference date. Navigation moves
 * that reference forward or back by one unit of the active view, so the whole
 * rendering pipeline (background grid, event window, fetch range) follows the
 * single reference date it already takes as `now`.
 */

import type { TimeView } from "../components/SegmentedControl";

export type Direction = -1 | 1;

/** Last day-of-month for a 0-based month, used to clamp month/year steps. */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns a new date moved one unit of `view` from `date` in `direction`.
 *
 * Month and year steps clamp the day to the target month's length so stepping
 * from the 31st (or Feb 29th) never overflows into the following month.
 */
export function stepPeriod(view: TimeView, date: Date, direction: Direction): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  switch (view) {
    case "day":
      return new Date(y, m, d + direction, date.getHours(), date.getMinutes());
    case "week":
      return new Date(y, m, d + 7 * direction, date.getHours(), date.getMinutes());
    case "month": {
      const targetMonth = m + direction;
      const clampedDay = Math.min(d, lastDayOfMonth(y, targetMonth));
      return new Date(y, targetMonth, clampedDay, date.getHours(), date.getMinutes());
    }
    case "year": {
      const targetYear = y + direction;
      const clampedDay = Math.min(d, lastDayOfMonth(targetYear, m));
      return new Date(targetYear, m, clampedDay, date.getHours(), date.getMinutes());
    }
  }
}

/** Monday-anchored start of the week containing `date` (local time, midnight). */
function startOfWeek(date: Date): Date {
  const jsDay = date.getDay(); // Sun=0
  const offset = jsDay === 0 ? 6 : jsDay - 1; // days since Monday
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

/**
 * Whether two dates fall in the same period for the given view — used to tell
 * when the reference is back on "today" so a reset control can hide itself.
 */
export function isSamePeriod(view: TimeView, a: Date, b: Date): boolean {
  switch (view) {
    case "day":
      return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
      );
    case "week": {
      const wa = startOfWeek(a);
      const wb = startOfWeek(b);
      return wa.getTime() === wb.getTime();
    }
    case "month":
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
    case "year":
      return a.getFullYear() === b.getFullYear();
  }
}

/** Human-readable label for the period containing `date` at `view` granularity. */
export function periodLabel(view: TimeView, date: Date): string {
  switch (view) {
    case "day":
      return date.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    case "week": {
      const start = startOfWeek(date);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      const sameMonth = start.getMonth() === end.getMonth();
      const startStr = start.toLocaleDateString(undefined, {
        day: "numeric",
        ...(sameMonth ? {} : { month: "short" }),
      });
      const endStr = end.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return `${startStr} – ${endStr}`;
    }
    case "month":
      return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    case "year":
      return String(date.getFullYear());
  }
}
