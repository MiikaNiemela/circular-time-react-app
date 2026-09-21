/**
 * Dev-only mock calendar data for exercising the click→EventDetail flow
 * without requiring OAuth. All exports return empty in production builds.
 */

import type { TimeView } from "../components/SegmentedControl";
import type { CalendarEvent, CalendarEventData } from "./calendarTimeline";
import { eventWindow } from "../data";

/** Builds a local-time ISO string for `base` at `totalMins` minutes past midnight. */
function localIsoFromMins(base: Date, totalMins: number): string {
  const d = new Date(base);
  d.setHours(Math.floor(totalMins / 60), totalMins % 60, 0, 0);
  return d.toISOString();
}

interface EventTemplate {
  title: string;
  /** Minutes past midnight. */
  startMins: number;
  endMins: number;
}

// Irregular durations keep arcs visually distinct on the timeline.
const TEMPLATES: EventTemplate[] = [
  { title: "Standup", startMins: 8 * 60 + 45, endMins: 9 * 60 + 15 },
  { title: "Deep work", startMins: 9 * 60 + 30, endMins: 11 * 60 + 45 },
  { title: "Review", startMins: 11 * 60 + 50, endMins: 12 * 60 + 20 },
  { title: "Sync", startMins: 13 * 60, endMins: 13 * 60 + 50 },
  { title: "Planning", startMins: 14 * 60 + 15, endMins: 15 * 60 },
  { title: "Code review", startMins: 15 * 60 + 20, endMins: 16 * 60 + 5 },
  { title: "Team check-in", startMins: 16 * 60 + 30, endMins: 17 * 60 },
  { title: "Wrap-up", startMins: 17 * 60 + 10, endMins: 17 * 60 + 40 },
];

const COLORS = ["#ffff2f", "#ff5733", "#34a853", "#2e00d4"];

function createEventsForCalendar(
  calendarId: string,
  rangeStart: Date,
  rangeEnd: Date,
  templateOffset: number,
  colorOffset: number,
  timeOffsetMins: number
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const cursor = new Date(rangeStart);
  let dayIndex = 0;
  let eventIndex = 0;

  while (cursor < rangeEnd) {
    TEMPLATES.forEach((_, i) => {
      const t = TEMPLATES[(i + templateOffset) % TEMPLATES.length];
      events.push({
        id: `${calendarId}-${dayIndex}-${i}`,
        calendarId,
        title: t.title,
        start: localIsoFromMins(cursor, t.startMins + timeOffsetMins),
        end: localIsoFromMins(cursor, t.endMins + timeOffsetMins),
        color: COLORS[(eventIndex + colorOffset) % COLORS.length],
      });
      eventIndex++;
    });
    cursor.setDate(cursor.getDate() + 1);
    dayIndex++;
  }

  return events;
}

/**
 * Builds two synthetic calendar entries spanning the full `view` window
 * centred on `reference` so the click→EventDetail flow is exercisable without
 * OAuth. Always returns [] in production builds.
 */
export function getDevFixtureCalendars(
  reference: Date,
  view: TimeView = "day"
): CalendarEventData[] {
  if (import.meta.env.PROD) return [];

  const fetchedRange = eventWindow(view, reference);
  const rangeStart = new Date(fetchedRange.start);
  const rangeEnd = new Date(fetchedRange.end);

  return [
    {
      calendarId: "dev-google",
      fetchedRange,
      // templateOffset=0, colorOffset=0: starts at Standup, yellow
      events: createEventsForCalendar("dev-google", rangeStart, rangeEnd, 0, 0, 0),
    },
    {
      calendarId: "dev-outlook",
      fetchedRange,
      // templateOffset=2, colorOffset=2, timeOffset=+3h: starts at Sync, green, afternoon-shifted
      events: createEventsForCalendar("dev-outlook", rangeStart, rangeEnd, 2, 2, 180),
    },
  ];
}
