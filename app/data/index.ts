/**
 * Public entry point for the calendar data layer.
 *
 * The UI imports from here; it never reaches into individual modules or — per
 * the architecture's strict boundaries — into provider internals.
 */
export type { TimeRange, CalendarEvent, CalendarProvider } from "./types";
export { CalendarCache } from "./cache";
export type { CacheEntry, KeyValueStorage } from "./cache";
export { shouldRefresh } from "./refreshPolicy";
export { eventSlicesForView, eventWindow, EVENT_COLORS } from "./eventSlices";
export type { EventSlicesOptions } from "./eventSlices";
export { CalendarVisibilityStore } from "./calendarVisibility";
