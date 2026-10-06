/**
 * All-day events for the day view: which ones the shown day has, and where
 * their icons sit on the arch above the circle.
 */
import type { AllDayKind, CalendarEvent, TimeRange } from "../data/types";
import { eventInterval } from "../data/eventSlices";

/** One all-day event on the shown day. */
export interface AllDayItem {
  /** `calendarId:id`, as for slices. */
  key: string;
  title: string;
  kind: AllDayKind;
  event: CalendarEvent;
}

const KIND_ORDER: Record<AllDayKind, number> = { birthday: 0, "time-off": 1, other: 2 };

/**
 * Whether an event belongs on the all-day arch for `day` rather than on the
 * ring: an all-day event touching the day, or time off covering the whole
 * day. Google out-of-office entries are always timed, so a full day off
 * arrives as a 00:00–24:00 timed event.
 */
export function isDayLong(event: CalendarEvent, day: TimeRange): boolean {
  const start = new Date(day.start).getTime();
  const end = new Date(day.end).getTime();
  const interval = eventInterval(event);
  if (event.allDay) return interval.end > start && interval.start < end;
  return event.kind === "time-off" && interval.start <= start && interval.end >= end;
}

/**
 * The day-long events (see `isDayLong`) of `day`, ordered birthdays first,
 * then time off, then others, each by title. An event cached before kinds
 * existed counts as `other`.
 */
export function allDayForDay(events: CalendarEvent[], day: TimeRange): AllDayItem[] {
  return events
    .filter((e) => isDayLong(e, day))
    .map((event) => ({
      key: `${event.calendarId}:${event.id}`,
      title: event.title,
      kind: event.kind ?? "other",
      event,
    }))
    .sort(
      (a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        a.title.localeCompare(b.title) ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
    );
}

/** Icons that fit on the arch before the rest collapse into "+N". */
export const ARCH_CAPACITY = 5;

/** Degrees between neighbouring arch icons. */
export const ARCH_STEP_DEG = 14;

/** Where the arch's icons go. */
export interface ArchLayout {
  /** Items drawn as their own icon, with their angle from 12 o'clock. */
  shown: Array<{ item: AllDayItem; degrees: number }>;
  /** How many items the "+N" icon stands for; 0 when all fit. */
  overflow: number;
  /** Angle of the "+N" icon, when there is one. */
  overflowDegrees?: number;
}

/**
 * Places icons symmetrically around 12 o'clock, `ARCH_STEP_DEG` apart. When
 * there are more than `capacity`, the last slot becomes a "+N" icon.
 */
export function archLayout(items: AllDayItem[], capacity = ARCH_CAPACITY): ArchLayout {
  const overflowing = items.length > capacity;
  const shownCount = overflowing ? capacity - 1 : items.length;
  const slots = overflowing ? capacity : items.length;
  const angle = (i: number) => (i - (slots - 1) / 2) * ARCH_STEP_DEG;
  return {
    shown: items.slice(0, shownCount).map((item, i) => ({ item, degrees: angle(i) })),
    overflow: overflowing ? items.length - shownCount : 0,
    ...(overflowing ? { overflowDegrees: angle(slots - 1) } : {}),
  };
}
