/**
 * Classifies events from the metadata the providers already return for the
 * primary calendar. Anything not recognised is `other`. Every event gets a
 * kind: Google out-of-office entries, for example, are always timed, and a
 * whole-day one is shown as day-long time off (see `isDayLong`).
 */
import type { AllDayKind } from "./types";

/** From a Google Calendar event's `eventType`. */
export function googleEventKind(eventType: string | undefined): AllDayKind {
  switch (eventType) {
    case "birthday":
      return "birthday";
    case "outOfOffice":
      return "time-off";
    default:
      return "other";
  }
}

/** From a Microsoft Graph event's `showAs`. */
export function outlookEventKind(showAs: string | undefined): AllDayKind {
  return showAs === "oof" ? "time-off" : "other";
}
