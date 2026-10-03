/**
 * The "now" marker for the day view: where the current-time hand points and
 * what the centre of the circle says.
 */
import type { TimeView } from "../components/SegmentedControl";
import { eventWindow } from "../data/eventSlices";
import type { TimeRange } from "../data/types";

/**
 * Angle of `instant` within `window`, clockwise from 12 o'clock, in degrees.
 *
 * This is the mapping the event slices use: elapsed time over the window's
 * real length. A day with a DST change is 23 or 25 hours long and still fills
 * the circle, so the hour marks are not 15° apart on those days.
 */
export function angleInWindow(instant: Date, window: TimeRange): number {
  const start = new Date(window.start).getTime();
  const end = new Date(window.end).getTime();
  const fraction = (instant.getTime() - start) / (end - start);
  return Math.min(1, Math.max(0, fraction)) * 360;
}

/** What the day view draws for the current time. */
export interface DayClock {
  /** Angle of the current-time hand; absent when the day shown is not today. */
  handDegrees?: number;
  /** Large centre line: the time today, the day number otherwise. */
  primary: string;
  /** Small centre line: the date. */
  secondary: string;
}

/**
 * The centre text and hand for the day view, or null for other views. Times
 * are 24-hour in the runtime's time zone, which in the browser is the user's.
 */
export function dayClock(
  view: TimeView,
  reference: Date,
  now: Date,
  locale?: string
): DayClock | null {
  if (view !== "day") return null;
  const shown = eventWindow("day", reference);
  const isToday = shown.start === eventWindow("day", now).start;

  if (isToday) {
    return {
      handDegrees: angleInWindow(now, shown),
      primary: new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(now),
      secondary: new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(now),
    };
  }
  const day = new Date(shown.start);
  return {
    primary: String(day.getDate()),
    secondary: [
      new Intl.DateTimeFormat(locale, { weekday: "short" }).format(day),
      new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(day),
    ].join(" "),
  };
}
