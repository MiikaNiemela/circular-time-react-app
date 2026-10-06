/**
 * Raw Google Calendar and Microsoft Graph responses covering every day-long
 * icon case, and what each should become on the timeline. The route test and
 * the route story both run them through the real providers, so "calendar
 * event data → drawn icon" is checked end to end.
 */
import { GoogleCalendarProvider } from "../data/providers/google/GoogleCalendarProvider";
import { OutlookCalendarProvider } from "../data/providers/outlook/OutlookCalendarProvider";
import { eventWindow } from "../data/eventSlices";
import type { AllDayKind } from "../data/types";
import type { CalendarEventData } from "./calendarTimeline";

/** An event on the arch: its title and the icon kind it must get. */
export interface DayLongExpectation {
  title: string;
  kind: AllDayKind;
}

/** Day-long events in arch order: birthdays, time off, others, each by title. */
export const EXPECTED_DAY_LONG: DayLongExpectation[] = [
  { title: "Mara's birthday", kind: "birthday" },
  { title: "Annual leave", kind: "time-off" },
  { title: "Out of office", kind: "time-off" },
  { title: "Sick day", kind: "time-off" },
  { title: "Conference", kind: "other" },
  { title: "Midsummer Eve", kind: "other" },
  { title: "Office", kind: "other" },
];

/** Events that stay timed: on the ring and in the agenda, not on the arch. */
export const EXPECTED_TIMED = ["Standup", "Dentist (out of office)"];

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The provider responses for the local calendar day `day`. */
export function providerResponses(day: Date) {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  const at = (h: number, min = 0, plusDays = 0) => new Date(y, m, d + plusDays, h, min);
  const today = dateKey(at(0));
  const tomorrow = dateKey(at(0, 0, 1));
  // Graph returns UTC wall-clock times without an offset.
  const graphTime = (date: Date) => date.toISOString().slice(0, -1);

  const google = {
    items: [
      {
        id: "g1",
        summary: "Mara's birthday",
        eventType: "birthday",
        start: { date: today },
        end: { date: tomorrow },
      },
      // Google out-of-office entries are always timed; a full day off is 00:00–24:00.
      {
        id: "g2",
        summary: "Out of office",
        eventType: "outOfOffice",
        start: { dateTime: at(0).toISOString() },
        end: { dateTime: at(0, 0, 1).toISOString() },
      },
      {
        id: "g3",
        summary: "Dentist (out of office)",
        eventType: "outOfOffice",
        start: { dateTime: at(13).toISOString() },
        end: { dateTime: at(15).toISOString() },
      },
      {
        id: "g4",
        summary: "Office",
        eventType: "workingLocation",
        start: { date: today },
        end: { date: tomorrow },
      },
      {
        id: "g5",
        summary: "Midsummer Eve",
        eventType: "default",
        start: { date: today },
        end: { date: tomorrow },
      },
      {
        id: "g6",
        summary: "Standup",
        eventType: "default",
        start: { dateTime: at(9).toISOString() },
        end: { dateTime: at(9, 30).toISOString() },
      },
    ],
  };
  const outlook = {
    value: [
      {
        id: "o1",
        subject: "Annual leave",
        isAllDay: true,
        showAs: "oof",
        start: { dateTime: `${today}T00:00:00`, timeZone: "UTC" },
        end: { dateTime: `${tomorrow}T00:00:00`, timeZone: "UTC" },
      },
      {
        id: "o2",
        subject: "Sick day",
        isAllDay: false,
        showAs: "oof",
        start: { dateTime: graphTime(at(0)), timeZone: "UTC" },
        end: { dateTime: graphTime(at(0, 0, 1)), timeZone: "UTC" },
      },
      {
        id: "o3",
        subject: "Conference",
        isAllDay: true,
        showAs: "busy",
        start: { dateTime: `${today}T00:00:00`, timeZone: "UTC" },
        end: { dateTime: `${tomorrow}T00:00:00`, timeZone: "UTC" },
      },
    ],
  };
  return { google, outlook };
}

const respond = (body: unknown) => async () =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Runs the responses for `day` through the real Google and Outlook providers
 * and returns the calendars as the timeline loader would.
 */
export async function eventKindCalendars(day: Date): Promise<CalendarEventData[]> {
  const responses = providerResponses(day);
  const range = eventWindow("day", day);
  const options = {
    accessToken: async () => "token",
    retry: { sleep: async () => undefined },
  };
  const google = new GoogleCalendarProvider({
    ...options,
    fetchFn: respond(responses.google) as unknown as typeof fetch,
  });
  const outlook = new OutlookCalendarProvider({
    ...options,
    fetchFn: respond(responses.outlook) as unknown as typeof fetch,
  });
  return [
    { calendarId: "google", events: await google.fetchEvents(range), fetchedRange: range },
    { calendarId: "outlook", events: await outlook.fetchEvents(range), fetchedRange: range },
  ];
}
