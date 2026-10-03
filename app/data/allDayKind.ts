/**
 * Classifies all-day events from the metadata the providers already return
 * for the primary calendar. Anything not recognised is `other`.
 */
import type { AllDayKind } from "./types";

/** From a Google Calendar event's `eventType`. */
export function googleAllDayKind(eventType: string | undefined): AllDayKind {
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
export function outlookAllDayKind(showAs: string | undefined): AllDayKind {
  return showAs === "oof" ? "time-off" : "other";
}
